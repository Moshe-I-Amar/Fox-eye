const mongoose = require('mongoose');
const User = require('../models/User');
const { LocationService } = require('./locationService');
const PresenceService = require('./presenceService');
const ViewportService = require('./viewportService');
const BreachService = require('./breachService');
const { buildScopeQuery } = require('../utils/filterByScope');

class SocketService {
  constructor(io) {
    this.io = io;
    this.locationService = new LocationService();
    this.presenceService = new PresenceService({ io });
    this.viewportService = new ViewportService({ io, presenceService: this.presenceService, viewportThrottleMs: 250 });
    this.breachService = new BreachService({
      io,
      emitToUser: this.presenceService.emitToUser.bind(this.presenceService),
      emitToAdmins: this.presenceService.emitToAdmins.bind(this.presenceService),
      emitToScope: this.presenceService.emitToAuthorized.bind(this.presenceService)
    });
    this.locationRateLimits = new Map(); // socket.id -> { windowStart, count, lastAt }
    this.locationWindowMs = Number(process.env.SOCKET_LOCATION_WINDOW_MS) || 10000;
    this.locationMaxPerWindow = Number(process.env.SOCKET_LOCATION_MAX_PER_WINDOW) || 25;
    this.locationMinIntervalMs = Number(process.env.SOCKET_LOCATION_MIN_INTERVAL_MS) || 400;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (${socket.id})`);
      this.presenceService.handleConnection(socket);

      // Handle location updates
      socket.on('location:update', async (data) => {
        try {
          await this.handleLocationUpdate(socket, data);
        } catch (error) {
          socket.emit('error', { message: 'Failed to update location', details: error.message });
        }
      });

      // Handle location requests
      socket.on('location:request', async (data) => {
        try {
          await this.handleLocationRequest(socket, data);
        } catch (error) {
          socket.emit('error', { message: 'Failed to get locations', details: error.message });
        }
      });

      // Handle user presence
      socket.on('presence:subscribe', async () => {
        try {
          await this.presenceService.handlePresenceSubscription(socket);
        } catch (error) {
          socket.emit('error', { message: 'Failed to subscribe to presence', details: error.message });
        }
      });

      // Handle viewport subscription updates
      socket.on('viewport:subscribe', async (data) => {
        try {
          await this.viewportService.handleViewportSubscription(socket, data);
        } catch (error) {
          socket.emit('error', { message: 'Failed to subscribe to viewport', details: error.message });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.userId} (${socket.id}) - ${reason}`);
        this.handleDisconnect(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });

      // Send initial connection confirmation
      socket.emit('connected', {
        userId: socket.userId,
        role: socket.userRole,
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleLocationUpdate(socket, data) {
    const { coordinates, timestamp } = data;
    if (!this.allowLocationUpdate(socket.id)) {
      socket.emit('error', { message: 'Location update rate limit exceeded' });
      return;
    }

    const { user, payload } = await this.locationService.updateUserLocation({
      userId: socket.userId,
      coordinates,
      timestamp,
      socketService: this,
      excludeSocketId: socket.id
    });

    this.presenceService.updateSocketUserInfo(socket.id, user);
    this.presenceService.updateUserProfile(socket.userId, user);

    // Confirm to sender
    socket.emit('location:updated:confirm', {
      success: true,
      location: payload,
      timestamp: new Date().toISOString()
    });
  }

  async handleLocationRequest(socket, data) {
    const { center, radius = 10, excludeSelf = false } = data;

    if (!center || !Array.isArray(center) || center.length !== 2) {
      throw new Error('Invalid center coordinates');
    }

    const [latitude, longitude] = center;
    const maxDistance = parseFloat(radius) * 1000; // Convert to meters

    const scopeQuery = buildScopeQuery(socket.userScope);
    if (!scopeQuery) {
      socket.emit('location:response', {
        users: [],
        center: { lat: latitude, lng: longitude, radius: parseFloat(radius) },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const queryClauses = [scopeQuery];
    if (excludeSelf) {
      queryClauses.push({ _id: { $ne: new mongoose.Types.ObjectId(socket.userId) } });
    }
    const query = queryClauses.length === 1 ? queryClauses[0] : { $and: queryClauses };

    // Get nearby users from database
    const onlineUserIds = this.presenceService
      .getOnlineUserIds()
      .map((id) => new mongoose.Types.ObjectId(id));
    const nearbyUsers = await User.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true,
          query
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          location: 1,
          createdAt: 1,
          distance: { $round: [{ $divide: ["$distance", 1000] }, 2] },
          isOnline: { $in: ["$_id", onlineUserIds] }
        }
      },
      {
        $sort: { distance: 1 }
      }
    ]);

    socket.emit('location:response', {
      users: nearbyUsers,
      center: { lat: latitude, lng: longitude, radius: parseFloat(radius) },
      timestamp: new Date().toISOString()
    });
  }

  handleDisconnect(socket) {
    this.presenceService.handleDisconnect(socket);
    this.viewportService.handleDisconnect(socket);
    this.breachService.clearUserState(socket.userId);
    this.locationRateLimits.delete(socket.id);
  }

  allowLocationUpdate(socketId) {
    const now = Date.now();
    const state = this.locationRateLimits.get(socketId) || {
      windowStart: now,
      count: 0,
      lastAt: 0
    };

    if (now - state.lastAt < this.locationMinIntervalMs) {
      return false;
    }

    if (now - state.windowStart > this.locationWindowMs) {
      state.windowStart = now;
      state.count = 0;
    }

    state.count += 1;
    state.lastAt = now;
    this.locationRateLimits.set(socketId, state);

    return state.count <= this.locationMaxPerWindow;
  }

  async broadcastLocationUpdate({ payload, excludeSocketId }) {
    if (!payload) {
      return;
    }

    const profile = this.presenceService.getUserProfile(payload.userId);
    if (profile) {
      profile.location = payload.location;
    }

    const minimalUpdate = {
      userId: payload.userId,
      coordinates: payload.coordinates,
      updatedAt: payload.updatedAt,
      ao: payload.ao || null
    };

    await this.viewportService.emitLocationUpdateToSubscribers({
      minimalUpdate,
      locationUpdate: payload,
      excludeSocketId
    });
  }

  async evaluateAoBreach({ user, coordinates, timestamp }) {
    return this.breachService.evaluateAoBreach({ user, coordinates, timestamp });
  }

  emitAoToCompanyScope(companyId, event, payload) {
    if (!companyId || !event) {
      return;
    }

    const targetCompanyId = String(companyId);

    for (const [socketId, recipientInfo] of this.presenceService.getUserSocketEntries()) {
      if (!recipientInfo) {
        continue;
      }

      if (recipientInfo.role === 'admin') {
        this.io.to(socketId).emit(event, payload);
        continue;
      }

      const userCompanyId = recipientInfo.userInfo?.companyId ? String(recipientInfo.userInfo.companyId) : null;
      if (userCompanyId && userCompanyId === targetCompanyId) {
        this.io.to(socketId).emit(event, payload);
        continue;
      }

      const scopeCompanies = (recipientInfo.userScope?.companies || []).map((id) => String(id));
      if (scopeCompanies.includes(targetCompanyId)) {
        this.io.to(socketId).emit(event, payload);
      }
    }
  }

  // Utility methods
  emitToUser(userId, event, data) {
    return this.presenceService.emitToUser(userId, event, data);
  }

  emitToAdmins(event, data) {
    this.presenceService.emitToAdmins(event, data);
  }

  getConnectedUsers() {
    return this.presenceService.getConnectedUsers();
  }
}

module.exports = SocketService;

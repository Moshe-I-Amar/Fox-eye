const mongoose = require('mongoose');
const User = require('../models/User');
const PresenceManager = require('../utils/presenceManager');
const { filterUsersByScope, buildScopeQuery } = require('../utils/filterByScope');
const { getAoForPoint, toAoSummary } = require('../utils/aoDetection');
const {
  normalizeBounds,
  getCellSizeForZoom,
  getCellId,
  getCellsForBounds,
  isPointInBounds,
  MAX_CELLS_PER_SUBSCRIPTION
} = require('../utils/grid');

class SocketService {
  constructor(io) {
    this.io = io;
    this.presenceManager = new PresenceManager();
    this.userSockets = new Map(); // socket.id -> userInfo
    this.userProfiles = new Map(); // userId -> userInfo
    this.socketViewports = new Map(); // socket.id -> viewport
    this.socketViewportRooms = new Map(); // socket.id -> Set(room)
    this.gridCellSizeCounts = new Map(); // cellSize -> count
    this.lastViewportUpdateAt = new Map(); // socket.id -> timestamp
    this.viewportThrottleMs = 250;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (${socket.id})`);
      
      // Store user connection
      this.userSockets.set(socket.id, {
        userId: socket.userId,
        role: socket.userRole,
        userInfo: socket.userInfo,
        userScope: socket.userScope,
        connectedAt: new Date()
      });
      this.userProfiles.set(socket.userId, socket.userInfo);

      const presenceUpdate = this.presenceManager.addSocket(socket.userId, socket.id);
      const presenceState = this.presenceManager.getPresence(socket.userId);

      // Join user to their own room
      socket.join(`user:${socket.userId}`);
      
      // Join admin room if user is admin
      if (socket.userRole === 'admin') {
        socket.join('admin');
      }

      if (presenceUpdate.wasOffline) {
        this.io.emit('presence:update', {
          userId: socket.userId,
          online: true,
          lastSeen: presenceState?.lastSeen || new Date()
        });
        socket.broadcast.emit('presence:user_joined', {
          userId: socket.userId,
          name: socket.userInfo.name,
          email: socket.userInfo.email,
          role: socket.userInfo.role,
          timestamp: new Date().toISOString()
        });
      }

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
          await this.handlePresenceSubscription(socket);
        } catch (error) {
          socket.emit('error', { message: 'Failed to subscribe to presence', details: error.message });
        }
      });

      // Handle viewport subscription updates
      socket.on('viewport:subscribe', async (data) => {
        try {
          await this.handleViewportSubscription(socket, data);
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
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new Error('Invalid coordinates format');
    }

    const [longitude, latitude] = coordinates;
    
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      throw new Error('Coordinates must be numbers');
    }

    // Validate coordinate ranges
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error('Coordinates out of valid range');
    }

    // Update user location in database
    const user = await User.findById(socket.userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    await user.save();

    const ao = await getAoForPoint({
      point: [longitude, latitude],
      companyId: user.companyId
    });
    const aoSummary = toAoSummary(ao);

    // Update stored user info
    const userInfo = this.userSockets.get(socket.id);
    if (userInfo) {
      userInfo.userInfo = user;
    }
    this.userProfiles.set(socket.userId, user);

    // Broadcast location update to all subscribed clients
    const locationUpdate = {
      userId: socket.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      ao: aoSummary,
      timestamp: timestamp || new Date().toISOString()
    };

    const minimalUpdate = {
      userId: socket.userId,
      coordinates: [longitude, latitude],
      updatedAt: user.updatedAt ? user.updatedAt.toISOString() : new Date().toISOString(),
      ao: aoSummary
    };

    await this.emitLocationUpdateToSubscribers({
      minimalUpdate,
      locationUpdate,
      excludeSocketId: socket.id
    });

    // Confirm to sender
    socket.emit('location:updated:confirm', {
      success: true,
      location: locationUpdate,
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
    const onlineUserIds = this.presenceManager
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

  async handlePresenceSubscription(socket) {
    // Get all connected users
    const connectedProfiles = [];
    const socketIdsByUser = new Map();
    for (const userId of this.presenceManager.getOnlineUserIds()) {
      const profile = this.userProfiles.get(userId);
      if (!profile) {
        continue;
      }
      const sockets = this.presenceManager.getSockets(userId);
      const socketId = sockets.values().next().value || null;
      socketIdsByUser.set(String(profile._id), socketId);
      connectedProfiles.push(profile);
    }

    const allowedProfiles = filterUsersByScope(connectedProfiles, socket.userScope);
    const connectedUsers = allowedProfiles.map((profile) => ({
      userId: profile._id.toString(),
      socketId: socketIdsByUser.get(String(profile._id)) || null,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      isOnline: true,
      lastSeen: this.presenceManager.getPresence(profile._id.toString())?.lastSeen || null,
      location: profile.location
    }));

    socket.emit('presence:users', {
      users: connectedUsers,
      timestamp: new Date().toISOString()
    });

  }

  async handleViewportSubscription(socket, data) {
    const now = Date.now();
    const lastUpdate = this.lastViewportUpdateAt.get(socket.id) || 0;
    if (now - lastUpdate < this.viewportThrottleMs) {
      return;
    }
    this.lastViewportUpdateAt.set(socket.id, now);

    if (!data) {
      throw new Error('Viewport payload is required');
    }

    const {
      minLat,
      minLng,
      maxLat,
      maxLng,
      zoom
    } = data;

    if (![minLat, minLng, maxLat, maxLng].every((value) => Number.isFinite(value))) {
      throw new Error('Viewport bounds must be numbers');
    }

    const normalized = normalizeBounds({ minLat, minLng, maxLat, maxLng });
    const cellSize = getCellSizeForZoom(zoom);
    const { cells, truncated } = getCellsForBounds(normalized, cellSize, MAX_CELLS_PER_SUBSCRIPTION);

    if (truncated) {
      console.warn(`Viewport subscription truncated for socket ${socket.id} (${cells.size} cells)`);
    }

    const previousViewport = this.socketViewports.get(socket.id);
    if (previousViewport?.cellSize && previousViewport.cellSize !== cellSize) {
      this.decrementCellSizeCount(previousViewport.cellSize);
    }
    if (!previousViewport?.cellSize || previousViewport.cellSize !== cellSize) {
      this.incrementCellSizeCount(cellSize);
    }

    const nextRooms = cells;
    const previousRooms = this.socketViewportRooms.get(socket.id) || new Set();

    for (const room of previousRooms) {
      if (!nextRooms.has(room)) {
        socket.leave(room);
      }
    }

    for (const room of nextRooms) {
      if (!previousRooms.has(room)) {
        socket.join(room);
      }
    }

    this.socketViewportRooms.set(socket.id, nextRooms);
    this.socketViewports.set(socket.id, {
      ...normalized,
      zoom,
      cellSize
    });
  }

  handleDisconnect(socket) {
    // Remove from connection maps
    this.userSockets.delete(socket.id);
    const presenceUpdate = this.presenceManager.removeSocket(socket.userId, socket.id);
    const presenceState = this.presenceManager.getPresence(socket.userId);

    // Notify others about user leaving
    if (!presenceUpdate.nowOnline) {
      this.io.emit('presence:update', {
        userId: socket.userId,
        online: false,
        lastSeen: presenceState?.lastSeen || new Date()
      });
      this.userProfiles.delete(socket.userId);
      socket.broadcast.emit('presence:user_left', {
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });
    }

    const viewport = this.socketViewports.get(socket.id);
    if (viewport?.cellSize) {
      this.decrementCellSizeCount(viewport.cellSize);
    }
    this.socketViewports.delete(socket.id);
    this.socketViewportRooms.delete(socket.id);
    this.lastViewportUpdateAt.delete(socket.id);
  }

  incrementCellSizeCount(cellSize) {
    const nextCount = (this.gridCellSizeCounts.get(cellSize) || 0) + 1;
    this.gridCellSizeCounts.set(cellSize, nextCount);
  }

  decrementCellSizeCount(cellSize) {
    const nextCount = (this.gridCellSizeCounts.get(cellSize) || 0) - 1;
    if (nextCount <= 0) {
      this.gridCellSizeCounts.delete(cellSize);
    } else {
      this.gridCellSizeCounts.set(cellSize, nextCount);
    }
  }

  async emitLocationUpdateToSubscribers({ minimalUpdate, locationUpdate, excludeSocketId }) {
    const [longitude, latitude] = minimalUpdate.coordinates;
    const candidateSockets = new Map();
    const targetProfile = this.userProfiles.get(minimalUpdate.userId);

    if (!targetProfile) {
      return;
    }

    for (const cellSize of this.gridCellSizeCounts.keys()) {
      const room = getCellId(latitude, longitude, cellSize);
      const sockets = await this.io.in(room).fetchSockets();
      for (const socket of sockets) {
        candidateSockets.set(socket.id, socket);
      }
    }

    for (const socket of candidateSockets.values()) {
      if (excludeSocketId && socket.id === excludeSocketId) {
        continue;
      }
      const viewport = this.socketViewports.get(socket.id);
      if (!viewport) {
        continue;
      }
      if (!isPointInBounds(viewport, latitude, longitude)) {
        continue;
      }
      const recipientInfo = this.userSockets.get(socket.id);
      if (!recipientInfo) {
        continue;
      }
      const isSelf = recipientInfo.userId === minimalUpdate.userId;
      if (!isSelf && filterUsersByScope([targetProfile], recipientInfo.userScope).length === 0) {
        continue;
      }
      socket.emit('location:update', minimalUpdate);
      socket.emit('location:updated', locationUpdate);
    }

    for (const [socketId, recipientInfo] of this.userSockets.entries()) {
      if (recipientInfo.role !== 'admin') {
        continue;
      }
      const isSelf = recipientInfo.userId === minimalUpdate.userId;
      if (!isSelf && filterUsersByScope([targetProfile], recipientInfo.userScope).length === 0) {
        continue;
      }
      this.io.to(socketId).emit('admin:location:updated', locationUpdate);
    }
  }

  async broadcastLocationUpdate({ userId, name, email, role, coordinates, ao, timestamp, updatedAt, excludeSocketId }) {
    const locationUpdate = {
      userId,
      name,
      email,
      role,
      location: {
        type: 'Point',
        coordinates
      },
      ao: ao || null,
      timestamp: timestamp || new Date().toISOString()
    };

    const minimalUpdate = {
      userId,
      coordinates,
      updatedAt: updatedAt || new Date().toISOString(),
      ao: ao || null
    };

    const profile = this.userProfiles.get(userId);
    if (profile) {
      profile.location = locationUpdate.location;
    }

    await this.emitLocationUpdateToSubscribers({
      minimalUpdate,
      locationUpdate,
      excludeSocketId
    });
  }

  // Utility methods
  emitToUser(userId, event, data) {
    const sockets = this.presenceManager.getSockets(userId);
    if (!sockets || sockets.size === 0) {
      return false;
    }
    for (const socketId of sockets) {
      this.io.to(socketId).emit(event, data);
    }
    return true;
  }

  emitToAdmins(event, data) {
    this.io.to('admin').emit(event, data);
  }

  getConnectedUsers() {
    const users = [];
    for (const [socketId, userInfo] of this.userSockets.entries()) {
      users.push({
        userId: userInfo.userId,
        socketId,
        role: userInfo.role,
        connectedAt: userInfo.connectedAt
      });
    }
    return users;
  }
}

module.exports = SocketService;

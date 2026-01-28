const mongoose = require('mongoose');
const User = require('../models/User');
const PresenceManager = require('../utils/presenceManager');

class SocketService {
  constructor(io) {
    this.io = io;
    this.presenceManager = new PresenceManager();
    this.userSockets = new Map(); // socket.id -> userInfo
    this.userProfiles = new Map(); // userId -> userInfo
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
      timestamp: timestamp || new Date().toISOString()
    };

    // Emit to all clients in general room (except sender)
    socket.broadcast.emit('location:updated', locationUpdate);
    
    // Emit to admin room
    this.io.to('admin').emit('admin:location:updated', locationUpdate);
    
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
          query: excludeSelf ? { _id: { $ne: new mongoose.Types.ObjectId(socket.userId) } } : {}
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
    const connectedUsers = [];
    for (const userId of this.presenceManager.getOnlineUserIds()) {
      const profile = this.userProfiles.get(userId);
      if (!profile) {
        continue;
      }
      const sockets = this.presenceManager.getSockets(userId);
      const socketId = sockets.values().next().value || null;
      connectedUsers.push({
        userId,
        socketId,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        isOnline: true,
        lastSeen: this.presenceManager.getPresence(userId)?.lastSeen || null,
        location: profile.location
      });
    }

    socket.emit('presence:users', {
      users: connectedUsers,
      timestamp: new Date().toISOString()
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

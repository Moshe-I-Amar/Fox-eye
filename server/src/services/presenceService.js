const PresenceManager = require('../utils/presenceManager');
const { filterUsersByScope } = require('../utils/filterByScope');

class PresenceService {
  constructor({ io, presenceManager } = {}) {
    if (!io) {
      throw new Error('PresenceService requires a socket.io instance');
    }

    this.io = io;
    this.presenceManager = presenceManager || new PresenceManager();
    this.userSockets = new Map(); // socket.id -> userInfo
    this.userProfiles = new Map(); // userId -> userInfo
  }

  handleConnection(socket) {
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

    socket.join(`user:${socket.userId}`);
    if (socket.userRole === 'admin') {
      socket.join('admin');
    }

    if (presenceUpdate.wasOffline) {
      this.emitPresenceEvent(socket.userInfo, 'presence:update', {
        userId: socket.userId,
        online: true,
        lastSeen: presenceState?.lastSeen || new Date()
      });
      this.emitPresenceEvent(socket.userInfo, 'presence:user_joined', {
        userId: socket.userId,
        name: socket.userInfo.name,
        email: socket.userInfo.email,
        role: socket.userInfo.role,
        timestamp: new Date().toISOString()
      }, { includeSelf: false });
    }

    return { presenceUpdate, presenceState };
  }

  handleDisconnect(socket) {
    this.userSockets.delete(socket.id);
    const presenceUpdate = this.presenceManager.removeSocket(socket.userId, socket.id);
    const presenceState = this.presenceManager.getPresence(socket.userId);

    if (!presenceUpdate.nowOnline) {
      this.emitPresenceEvent(socket.userInfo, 'presence:update', {
        userId: socket.userId,
        online: false,
        lastSeen: presenceState?.lastSeen || new Date()
      });
      this.userProfiles.delete(socket.userId);
      this.emitPresenceEvent(socket.userInfo, 'presence:user_left', {
        userId: socket.userId,
        timestamp: new Date().toISOString()
      }, { includeSelf: false });
    }

    return { presenceUpdate, presenceState };
  }

  async handlePresenceSubscription(socket) {
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

  updateUserProfile(userId, profile) {
    if (!userId || !profile) {
      return;
    }
    this.userProfiles.set(userId, profile);
  }

  updateSocketUserInfo(socketId, userInfo) {
    if (!socketId || !userInfo) {
      return;
    }
    const current = this.userSockets.get(socketId);
    if (current) {
      current.userInfo = userInfo;
    }
  }

  getUserProfile(userId) {
    return this.userProfiles.get(userId);
  }

  getUserSocketInfo(socketId) {
    return this.userSockets.get(socketId);
  }

  getUserSocketEntries() {
    return this.userSockets.entries();
  }

  getOnlineUserIds() {
    return this.presenceManager.getOnlineUserIds();
  }

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

  emitPresenceEvent(targetProfile, event, payload, { includeSelf = true } = {}) {
    if (!targetProfile) {
      return;
    }

    for (const [socketId, recipientInfo] of this.userSockets.entries()) {
      const isSelf = recipientInfo.userId === targetProfile._id?.toString?.();
      if (!includeSelf && isSelf) {
        continue;
      }
      if (!isSelf && filterUsersByScope([targetProfile], recipientInfo.userScope).length === 0) {
        continue;
      }
      this.io.to(socketId).emit(event, payload);
    }
  }

  emitToAuthorized(targetProfile, event, payload, options) {
    this.emitPresenceEvent(targetProfile, event, payload, options);
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

module.exports = PresenceService;

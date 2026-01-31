const User = require('../models/User');

class PresenceManager {
  constructor({ offlineWriteDelayMs = 2000 } = {}) {
    this.presence = new Map(); // userId -> { sockets:Set, lastSeen:Date, online:boolean }
    this.offlineWriteDelayMs = offlineWriteDelayMs;
    this.offlineWriteTimers = new Map();
    this.pendingUpdates = new Map();
    this.flushTimer = null;
    this.flushIntervalMs = 1000;
  }

  getPresence(userId) {
    return this.presence.get(userId);
  }

  getOnlineUserIds() {
    const ids = [];
    for (const [userId, presence] of this.presence.entries()) {
      if (presence.online) {
        ids.push(userId);
      }
    }
    return ids;
  }

  getSockets(userId) {
    const presence = this.presence.get(userId);
    return presence ? presence.sockets : new Set();
  }

  isOnline(userId) {
    const presence = this.presence.get(userId);
    return presence ? presence.online : false;
  }

  addSocket(userId, socketId) {
    const presence = this.ensurePresence(userId);
    const wasOffline = !presence.online;

    presence.sockets.add(socketId);
    presence.online = true;
    presence.lastSeen = new Date();

    this.clearOfflineTimer(userId);
    this.persistPresence(userId, presence.online, presence.lastSeen);

    return { wasOffline, nowOnline: presence.online };
  }

  removeSocket(userId, socketId) {
    const presence = this.presence.get(userId);
    if (!presence) {
      return { nowOnline: false };
    }

    presence.sockets.delete(socketId);
    presence.lastSeen = new Date();

    if (presence.sockets.size === 0) {
      presence.online = false;
      this.scheduleOfflinePersist(userId, presence.lastSeen);
    }

    return { nowOnline: presence.online };
  }

  ensurePresence(userId) {
    let presence = this.presence.get(userId);
    if (!presence) {
      presence = {
        sockets: new Set(),
        lastSeen: null,
        online: false
      };
      this.presence.set(userId, presence);
    }
    return presence;
  }

  clearOfflineTimer(userId) {
    const timer = this.offlineWriteTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.offlineWriteTimers.delete(userId);
    }
  }

  scheduleOfflinePersist(userId, lastSeen) {
    this.clearOfflineTimer(userId);

    if (this.offlineWriteDelayMs <= 0) {
      this.persistPresence(userId, false, lastSeen);
      return;
    }

    const timer = setTimeout(() => {
      const presence = this.presence.get(userId);
      if (!presence || presence.sockets.size > 0 || presence.online) {
        return;
      }
      this.persistPresence(userId, false, presence.lastSeen || lastSeen);
      this.offlineWriteTimers.delete(userId);
    }, this.offlineWriteDelayMs);

    this.offlineWriteTimers.set(userId, timer);
  }

  persistPresence(userId, online, lastSeen) {
    this.pendingUpdates.set(userId, { online, lastSeen });
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushUpdates();
    }, this.flushIntervalMs);
  }

  flushUpdates() {
    const updates = Array.from(this.pendingUpdates.entries());
    if (!updates.length) {
      return;
    }
    this.pendingUpdates.clear();
    const ops = updates.map(([userId, payload]) => ({
      updateOne: {
        filter: { _id: userId },
        update: { $set: payload }
      }
    }));
    User.bulkWrite(ops).catch((error) => {
      console.error('Failed to persist presence batch:', error);
    });
  }
}

module.exports = PresenceManager;

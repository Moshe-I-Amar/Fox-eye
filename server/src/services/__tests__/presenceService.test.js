const test = require('node:test');
const assert = require('node:assert/strict');

const PresenceService = require('../presenceService');

class FakePresenceManager {
  constructor() {
    this.presence = new Map();
  }

  addSocket(userId, socketId) {
    const entry = this.presence.get(userId) || { sockets: new Set(), online: false, lastSeen: null };
    const wasOffline = !entry.online;
    entry.sockets.add(socketId);
    entry.online = true;
    entry.lastSeen = new Date();
    this.presence.set(userId, entry);
    return { wasOffline, nowOnline: entry.online };
  }

  removeSocket(userId, socketId) {
    const entry = this.presence.get(userId);
    if (!entry) {
      return { nowOnline: false };
    }
    entry.sockets.delete(socketId);
    entry.lastSeen = new Date();
    if (entry.sockets.size === 0) {
      entry.online = false;
    }
    return { nowOnline: entry.online };
  }

  getPresence(userId) {
    return this.presence.get(userId);
  }

  getSockets(userId) {
    return this.presence.get(userId)?.sockets || new Set();
  }

  getOnlineUserIds() {
    const ids = [];
    for (const [userId, entry] of this.presence.entries()) {
      if (entry.online) {
        ids.push(userId);
      }
    }
    return ids;
  }
}

const createIo = () => {
  const events = [];
  const roomEvents = [];
  return {
    events,
    roomEvents,
    io: {
      emit: (event, payload) => events.push({ event, payload }),
      to: (room) => ({
        emit: (event, payload) => roomEvents.push({ room, event, payload })
      })
    }
  };
};

test('PresenceService tracks connections and disconnections', () => {
  const { io, events } = createIo();
  const broadcastEvents = [];
  const joins = [];
  const presenceManager = new FakePresenceManager();
  const service = new PresenceService({ io, presenceManager });

  const socket = {
    id: 'socket-1',
    userId: 'user-1',
    userRole: 'admin',
    userInfo: { _id: 'user-1', name: 'Ada', email: 'ada@example.com', role: 'admin' },
    userScope: { companies: ['company-1'] },
    join: (room) => joins.push(room),
    broadcast: {
      emit: (event, payload) => broadcastEvents.push({ event, payload })
    }
  };

  service.handleConnection(socket);

  assert.equal(service.getConnectedUsers().length, 1);
  assert.ok(joins.includes('user:user-1'));
  assert.ok(joins.includes('admin'));
  assert.ok(events.find((entry) => entry.event === 'presence:update'));

  service.handleDisconnect(socket);
  assert.ok(broadcastEvents.find((entry) => entry.event === 'presence:user_left'));
});

test('PresenceService sends scoped presence list', async () => {
  const { io } = createIo();
  const presenceManager = new FakePresenceManager();
  const service = new PresenceService({ io, presenceManager });

  const userInfo = {
    _id: 'user-2',
    name: 'Bryn',
    email: 'bryn@example.com',
    role: 'user',
    companyId: 'company-2'
  };

  const socket = {
    id: 'socket-2',
    userId: 'user-2',
    userRole: 'user',
    userInfo,
    userScope: { companies: ['company-2'] },
    join: () => {},
    broadcast: { emit: () => {} }
  };

  service.handleConnection(socket);

  let emitted = null;
  const subscriber = {
    ...socket,
    emit: (event, payload) => {
      emitted = { event, payload };
    }
  };

  await service.handlePresenceSubscription(subscriber);

  assert.equal(emitted.event, 'presence:users');
  assert.equal(emitted.payload.users.length, 1);
  assert.equal(emitted.payload.users[0].userId, 'user-2');
});

const test = require('node:test');
const assert = require('node:assert/strict');

const ViewportService = require('../viewportService');

test('ViewportService emits updates to subscribed sockets', async () => {
  const socketEvents = [];
  const adminEvents = [];
  const joins = [];
  const roomSockets = new Map();

  const presenceSocketInfo = new Map([
    ['socket-viewer', { userId: 'viewer-1', role: 'user', userScope: { companies: ['company-1'] } }],
    ['socket-admin', { userId: 'admin-1', role: 'admin', userScope: { companies: ['company-1'] } }]
  ]);

  const presenceService = {
    getUserProfile: () => ({ _id: 'target-1', companyId: 'company-1' }),
    getUserSocketInfo: (socketId) => presenceSocketInfo.get(socketId),
    getUserSocketEntries: () => presenceSocketInfo.entries()
  };

  const io = {
    in: (room) => ({
      fetchSockets: async () => roomSockets.get(room) || []
    }),
    to: (socketId) => ({
      emit: (event, payload) => adminEvents.push({ socketId, event, payload })
    })
  };

  const service = new ViewportService({ io, presenceService, viewportThrottleMs: 0 });

  const subscriberSocket = {
    id: 'socket-viewer',
    join: (room) => joins.push(room),
    leave: () => {},
    emit: (event, payload) => socketEvents.push({ event, payload })
  };

  await service.handleViewportSubscription(subscriberSocket, {
    minLat: 0,
    minLng: 0,
    maxLat: 1,
    maxLng: 1,
    zoom: 10
  });

  for (const room of joins) {
    roomSockets.set(room, [subscriberSocket]);
  }

  await service.emitLocationUpdateToSubscribers({
    minimalUpdate: {
      userId: 'target-1',
      coordinates: [0.5, 0.5],
      updatedAt: new Date().toISOString(),
      ao: null
    },
    locationUpdate: {
      userId: 'target-1',
      name: 'Target',
      email: 'target@example.com',
      role: 'user',
      location: {
        type: 'Point',
        coordinates: [0.5, 0.5]
      },
      ao: null,
      timestamp: new Date().toISOString()
    }
  });

  assert.ok(socketEvents.find((entry) => entry.event === 'location:update'));
  assert.ok(socketEvents.find((entry) => entry.event === 'location:updated'));
  assert.ok(adminEvents.find((entry) => entry.event === 'admin:location:updated'));
});

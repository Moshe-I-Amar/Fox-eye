const test = require('node:test');
const assert = require('node:assert/strict');

const { LocationService } = require('../locationService');

const createUser = (overrides = {}) => ({
  _id: 'user-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'member',
  companyId: 'company-1',
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  location: null,
  save: async function save() {
    this.updatedAt = new Date('2025-01-02T03:04:05.000Z');
    return this;
  },
  ...overrides
});

test('updateUserLocation writes location and emits a canonical payload', async () => {
  const user = createUser();
  const aoUtils = {
    getAoForPoint: async () => ({ _id: 'ao-1', name: 'AO Alpha' }),
    toAoSummary: (ao) => ({ id: ao._id, name: ao.name })
  };
  const socketCalls = {
    evaluate: [],
    broadcast: []
  };
  const socketService = {
    evaluateAoBreach: async (payload) => socketCalls.evaluate.push(payload),
    broadcastLocationUpdate: async (payload) => socketCalls.broadcast.push(payload)
  };
  const locationService = new LocationService({ userModel: {}, aoUtils });

  const result = await locationService.updateUserLocation({
    user,
    coordinates: [10, 20],
    timestamp: '2025-01-02T12:00:00.000Z',
    socketService,
    excludeSocketId: 'socket-1'
  });

  assert.deepEqual(user.location, {
    type: 'Point',
    coordinates: [10, 20]
  });
  assert.equal(socketCalls.evaluate.length, 1);
  assert.equal(socketCalls.broadcast.length, 1);

  const payload = socketCalls.broadcast[0].payload;
  assert.deepEqual(payload, {
    userId: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'member',
    coordinates: [10, 20],
    location: { type: 'Point', coordinates: [10, 20] },
    ao: { id: 'ao-1', name: 'AO Alpha' },
    updatedAt: '2025-01-02T03:04:05.000Z',
    timestamp: '2025-01-02T12:00:00.000Z'
  });
  assert.equal(socketCalls.broadcast[0].excludeSocketId, 'socket-1');
  assert.equal(result.payload.timestamp, '2025-01-02T12:00:00.000Z');
  assert.deepEqual(result.ao, { id: 'ao-1', name: 'AO Alpha' });
});

test('updateUserLocation loads user when userId is provided', async () => {
  const user = createUser({ _id: 'user-2' });
  const calls = [];
  const locationService = new LocationService({
    userModel: {
      findById: async (id) => {
        calls.push(id);
        return user;
      }
    },
    aoUtils: {
      getAoForPoint: async () => null,
      toAoSummary: () => null
    }
  });

  const result = await locationService.updateUserLocation({
    userId: 'user-2',
    coordinates: [1, 2]
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'user-2');
  assert.equal(result.user, user);
});

test('updateUserLocation rejects invalid coordinates', async () => {
  const locationService = new LocationService({ userModel: {} });

  await assert.rejects(
    () => locationService.updateUserLocation({ userId: 'user-3', coordinates: ['x', 2] }),
    /Coordinates must be numbers/
  );
});

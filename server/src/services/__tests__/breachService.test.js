const test = require('node:test');
const assert = require('node:assert/strict');

const BreachService = require('../breachService');

test('BreachService records approaching boundary events', async () => {
  const violationEvents = [];
  const violationModel = {
    create: async (payload) => {
      violationEvents.push(payload);
    }
  };

  const ao = { _id: 'ao-1', name: 'Alpha', polygon: [] };
  const aoDetection = {
    getActiveAos: async () => [ao],
    findAoForPointWithTolerance: () => ao,
    distanceToPolygonEdgeMeters: () => 10
  };

  const breachService = new BreachService({
    io: { to: () => ({ emit: () => {} }) },
    emitToUser: () => true,
    emitToAdmins: () => {},
    violationModel,
    aoDetection,
    configOverrides: {
      approachingMeters: 50,
      approachingCooldownMs: 0
    }
  });

  await breachService.evaluateAoBreach({
    user: {
      _id: 'user-1',
      companyId: 'company-1',
      name: 'Casey',
      email: 'casey@example.com',
      role: 'user'
    },
    coordinates: [12.34, 56.78],
    timestamp: new Date().toISOString()
  });

  assert.equal(violationEvents.length, 1);
  assert.equal(violationEvents[0].type, 'APPROACHING_BOUNDARY');
});

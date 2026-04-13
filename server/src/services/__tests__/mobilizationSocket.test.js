'use strict';

/**
 * mobilizationSocket.test.js
 *
 * Tests the mobilization socket-broadcast routing logic with two concurrent
 * users connected. Exercises _isInMobilizationScope, broadcastMobilizationActivated,
 * and broadcastMobilizationUpdate without a real Socket.IO server or DB.
 *
 * Strategy: extract the three broadcast methods from SocketService.prototype
 * via Object.create() so they run against a hand-crafted in-memory
 * presenceService and io, avoiding the full constructor.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');

// ─── Helpers ────────────────────────────────────────────────────────────────

const uid = (n) => String(n).padStart(24, '0');

/**
 * Create a fake io that collects every emit call keyed by socketId.
 * Returns { io, emitted } where emitted is an array of { socketId, event, payload }.
 */
const createFakeIo = () => {
  const emitted = [];
  const io = {
    on: () => {},          // no-op — we don't need 'connection' handler
    to: (socketId) => ({
      emit: (event, payload) => emitted.push({ socketId, event, payload }),
    }),
    to_room: (room) => ({  // rooms (e.g. 'admin') — unused in mobilization path
      emit: () => {},
    }),
  };
  return { io, emitted };
};

/**
 * Build a fake presenceService with a given userSockets Map.
 * The map mirrors PresenceService.userSockets:
 *   socketId → { userId, role, userInfo: { unitId, companyId, teamId, ... } }
 */
const buildPresenceService = (userSockets) => ({
  getUserSocketEntries: () => userSockets.entries(),
});

/**
 * Create a minimal SocketService-like broadcaster that uses the REAL
 * prototype methods (copied from SocketService.prototype via Object.create)
 * but injected with our fakes, bypassing the heavy constructor.
 */
const buildBroadcaster = (io, userSockets) => {
  // Load the class module — safe because require() only executes module-level
  // code, not the constructor. SocketService module-level requires are
  // benign (mongoose, User model etc. just register schemas; no DB connection).
  const SocketService = require('../socketService');

  const broadcaster = Object.create(SocketService.prototype);
  broadcaster.io = io;
  broadcaster.presenceService = buildPresenceService(userSockets);
  return broadcaster;
};

// ─── Fixtures ───────────────────────────────────────────────────────────────

const UNIT_A    = uid(1);
const COMPANY_A = uid(10);
const TEAM_A    = uid(100);
const TEAM_B    = uid(101);

/** A mobilization targeting the entire unit (no company / team filter) */
const unitWideMob = {
  targetScope: { unitId: UNIT_A, companyId: null, teamId: null },
  toObject() { return { ...this }; },
};

/** A mobilization scoped to a specific company */
const companyScopedMob = {
  targetScope: { unitId: UNIT_A, companyId: COMPANY_A, teamId: null },
  toObject() { return { ...this }; },
};

/** A mobilization scoped to a specific team */
const teamScopedMob = {
  targetScope: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A },
  toObject() { return { ...this }; },
};

// ════════════════════════════════════════════════════════════════════════════
// _isInMobilizationScope
// ════════════════════════════════════════════════════════════════════════════

test('_isInMobilizationScope: admin always returns true regardless of unitId', () => {
  const { io } = createFakeIo();
  const broadcaster = buildBroadcaster(io, new Map());

  const adminInfo = { role: 'admin', userInfo: { unitId: uid(999) } };
  assert.ok(broadcaster._isInMobilizationScope(adminInfo, { unitId: UNIT_A }));
});

test('_isInMobilizationScope: user in same unit — unit-wide scope matches', () => {
  const { io } = createFakeIo();
  const broadcaster = buildBroadcaster(io, new Map());

  const userInfo = { role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A } };
  assert.ok(broadcaster._isInMobilizationScope(userInfo, { unitId: UNIT_A, companyId: null, teamId: null }));
});

test('_isInMobilizationScope: user in different unit — no match', () => {
  const { io } = createFakeIo();
  const broadcaster = buildBroadcaster(io, new Map());

  const userInfo = { role: 'user', userInfo: { unitId: uid(99), companyId: COMPANY_A } };
  assert.ok(!broadcaster._isInMobilizationScope(userInfo, { unitId: UNIT_A, companyId: null, teamId: null }));
});

test('_isInMobilizationScope: company scope — wrong company does not match', () => {
  const { io } = createFakeIo();
  const broadcaster = buildBroadcaster(io, new Map());

  const userInfo = { role: 'user', userInfo: { unitId: UNIT_A, companyId: uid(999), teamId: TEAM_A } };
  assert.ok(!broadcaster._isInMobilizationScope(userInfo, { unitId: UNIT_A, companyId: COMPANY_A, teamId: null }));
});

test('_isInMobilizationScope: team scope — correct team matches', () => {
  const { io } = createFakeIo();
  const broadcaster = buildBroadcaster(io, new Map());

  const userInfo = { role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A } };
  assert.ok(broadcaster._isInMobilizationScope(userInfo, { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A }));
});

test('_isInMobilizationScope: team scope — wrong team does not match', () => {
  const { io } = createFakeIo();
  const broadcaster = buildBroadcaster(io, new Map());

  const userInfo = { role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_B } };
  assert.ok(!broadcaster._isInMobilizationScope(userInfo, { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A }));
});

// ════════════════════════════════════════════════════════════════════════════
// broadcastMobilizationActivated — two concurrent users
// ════════════════════════════════════════════════════════════════════════════

test('broadcastMobilizationActivated: in-scope user receives event, out-of-scope user does not', () => {
  const { io, emitted } = createFakeIo();

  // User 1 — same unit → should receive
  // User 2 — different unit → should NOT receive
  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A } }],
    ['socket-u2', { userId: uid(2), role: 'user', userInfo: { unitId: uid(99), companyId: uid(10), teamId: uid(100) } }],
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  broadcaster.broadcastMobilizationActivated(unitWideMob);

  const socketIds = emitted.filter((e) => e.event === 'mobilization:activated').map((e) => e.socketId);
  assert.ok(socketIds.includes('socket-u1'), 'in-scope user should receive the event');
  assert.ok(!socketIds.includes('socket-u2'), 'out-of-scope user should NOT receive the event');
});

test('broadcastMobilizationActivated: admin receives even when in a different unit', () => {
  const { io, emitted } = createFakeIo();

  const userSockets = new Map([
    ['socket-admin', { userId: uid(99), role: 'admin', userInfo: { unitId: uid(999) } }],
    ['socket-u1',    { userId: uid(1),  role: 'user',  userInfo: { unitId: UNIT_A } }],
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  broadcaster.broadcastMobilizationActivated(unitWideMob);

  const socketIds = emitted.filter((e) => e.event === 'mobilization:activated').map((e) => e.socketId);
  assert.ok(socketIds.includes('socket-admin'), 'admin should always receive mobilization events');
  assert.ok(socketIds.includes('socket-u1'));
});

test('broadcastMobilizationActivated: two users in scope BOTH receive the event', () => {
  const { io, emitted } = createFakeIo();

  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A } }],
    ['socket-u2', { userId: uid(2), role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_B } }],
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  broadcaster.broadcastMobilizationActivated(unitWideMob);  // unit-wide → both match

  const socketIds = emitted.filter((e) => e.event === 'mobilization:activated').map((e) => e.socketId);
  assert.ok(socketIds.includes('socket-u1'), 'user 1 should receive');
  assert.ok(socketIds.includes('socket-u2'), 'user 2 should receive');
  assert.equal(socketIds.length, 2, 'exactly two emit calls');
});

test('broadcastMobilizationActivated: company-scoped — only same-company user receives', () => {
  const { io, emitted } = createFakeIo();

  // u1 in COMPANY_A → receives; u2 in different company → does not
  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A,  teamId: TEAM_A } }],
    ['socket-u2', { userId: uid(2), role: 'user', userInfo: { unitId: UNIT_A, companyId: uid(99),    teamId: uid(200) } }],
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  broadcaster.broadcastMobilizationActivated(companyScopedMob);

  const socketIds = emitted.filter((e) => e.event === 'mobilization:activated').map((e) => e.socketId);
  assert.ok(socketIds.includes('socket-u1'));
  assert.ok(!socketIds.includes('socket-u2'), 'user in other company must not receive');
});

test('broadcastMobilizationActivated: team-scoped — only exact-team user receives', () => {
  const { io, emitted } = createFakeIo();

  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A } }],
    ['socket-u2', { userId: uid(2), role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_B } }],
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  broadcaster.broadcastMobilizationActivated(teamScopedMob);  // targets TEAM_A only

  const socketIds = emitted.filter((e) => e.event === 'mobilization:activated').map((e) => e.socketId);
  assert.ok(socketIds.includes('socket-u1'),  'team-A user receives');
  assert.ok(!socketIds.includes('socket-u2'), 'team-B user should not receive');
});

test('broadcastMobilizationActivated: payload contains mobilization and timestamp', () => {
  const { io, emitted } = createFakeIo();

  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A } }],
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  broadcaster.broadcastMobilizationActivated(unitWideMob);

  const entry = emitted.find((e) => e.event === 'mobilization:activated');
  assert.ok(entry, 'event must be emitted');
  assert.ok(entry.payload.mobilization, 'payload must include mobilization');
  assert.ok(typeof entry.payload.timestamp === 'string', 'payload must include timestamp string');
});

// ════════════════════════════════════════════════════════════════════════════
// broadcastMobilizationUpdate — phase advance and stand-down events
// ════════════════════════════════════════════════════════════════════════════

test('broadcastMobilizationUpdate: mobilization:status_changed reaches in-scope users', () => {
  const { io, emitted } = createFakeIo();

  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A, companyId: COMPANY_A, teamId: TEAM_A } }],
    ['socket-u2', { userId: uid(2), role: 'user', userInfo: { unitId: uid(99) } }],
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  const transitMob = { ...unitWideMob, status: 'TRANSIT', toObject() { return { ...this }; } };
  broadcaster.broadcastMobilizationUpdate(transitMob, 'mobilization:status_changed');

  const hits = emitted.filter((e) => e.event === 'mobilization:status_changed');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].socketId, 'socket-u1');
});

test('broadcastMobilizationUpdate: mobilization:stood_down reaches all in-scope sockets', () => {
  const { io, emitted } = createFakeIo();

  // Two users in scope — both should receive the stand-down event
  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A } }],
    ['socket-u2', { userId: uid(2), role: 'user', userInfo: { unitId: UNIT_A } }],
    ['socket-u3', { userId: uid(3), role: 'user', userInfo: { unitId: uid(99) } }], // different unit
  ]);

  const broadcaster = buildBroadcaster(io, userSockets);
  const stoodDownMob = { ...unitWideMob, status: 'STOOD_DOWN', toObject() { return { ...this }; } };
  broadcaster.broadcastMobilizationUpdate(stoodDownMob, 'mobilization:stood_down');

  const hits = emitted.filter((e) => e.event === 'mobilization:stood_down').map((e) => e.socketId);
  assert.ok(hits.includes('socket-u1'), 'u1 receives stood_down');
  assert.ok(hits.includes('socket-u2'), 'u2 receives stood_down');
  assert.ok(!hits.includes('socket-u3'), 'u3 (different unit) does not receive');
  assert.equal(hits.length, 2);
});

test('broadcastMobilizationUpdate: two simultaneous users advancing through full phase cycle', () => {
  // Simulates two users watching as a mobilization advances ACTIVE→TRANSIT→PREPARATION→DEPLOYMENT
  const phases = [
    { status: 'TRANSIT',     event: 'mobilization:status_changed' },
    { status: 'PREPARATION', event: 'mobilization:status_changed' },
    { status: 'DEPLOYMENT',  event: 'mobilization:status_changed' },
  ];

  const userSockets = new Map([
    ['socket-u1', { userId: uid(1), role: 'user', userInfo: { unitId: UNIT_A } }],
    ['socket-u2', { userId: uid(2), role: 'user', userInfo: { unitId: UNIT_A } }],
  ]);

  for (const { status, event } of phases) {
    const { io, emitted } = createFakeIo();
    const broadcaster = buildBroadcaster(io, userSockets);
    const mob = { ...unitWideMob, status, toObject() { return { ...this }; } };

    broadcaster.broadcastMobilizationUpdate(mob, event);

    const hits = emitted.filter((e) => e.event === event);
    assert.equal(hits.length, 2, `both users must receive ${event} for status ${status}`);
    assert.ok(hits[0].payload.mobilization.status === status, 'payload carries new status');
  }
});

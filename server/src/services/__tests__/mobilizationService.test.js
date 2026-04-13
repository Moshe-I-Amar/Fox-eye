'use strict';

/**
 * mobilizationService.test.js
 *
 * Unit tests for mobilizationService — no real DB, no real Mongoose.
 * MobilizationEvent and the authorize middleware are stubbed via require.cache
 * before the service module is loaded.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');

// ─── Helpers ────────────────────────────────────────────────────────────────

const RANK = {
  HQ:                5,
  UNIT_COMMANDER:    4,
  COMPANY_COMMANDER: 3,
  TEAM_COMMANDER:    2,
  SQUAD_COMMANDER:   1,
};

/** Zero-pad a number to a 24-char hex string — Mongoose ObjectId stand-in */
const uid = (n) => String(n).padStart(24, '0');

// ─── Stub: middleware/authorize ──────────────────────────────────────────────

const authorizePath = require.resolve('../../middleware/authorize');
require.cache[authorizePath] = {
  id: authorizePath, filename: authorizePath, loaded: true,
  exports: { OPERATIONAL_ROLE_RANK: RANK },
};

// ─── Stub: models/MobilizationEvent ─────────────────────────────────────────

const VALID_TRANSITIONS = {
  ACTIVE:      ['TRANSIT'],
  TRANSIT:     ['PREPARATION'],
  PREPARATION: ['DEPLOYMENT'],
  DEPLOYMENT:  [],
};

// Per-test overrides — reset in each test that needs DB behaviour
let _findOneFn   = async () => null;   // should return a doc or null
let _findByIdFn  = async () => null;   // should return a doc or null
let _findFn      = async () => [];     // should return array of docs
let _lastSavedDoc = null;

/**
 * Build a Mongoose-like query stub that supports the method chains used in
 * mobilizationService: findOne(...).lean() and find(...).populate().sort().lean()
 */
const makeQuery = (resolveFn) => ({
  lean:     async () => resolveFn(),
  populate: function () { return this; },
  sort:     function () { return this; },
});

class FakeMobilizationEvent {
  constructor(data) {
    Object.assign(this, data);
    this.status = data.status || 'ACTIVE';
  }

  async save() {
    _lastSavedDoc = this;
    return this;
  }

  toObject() { return { ...this }; }

  static findOne(...args)  { return makeQuery(() => _findOneFn(...args)); }
  static findById(id)      { return _findByIdFn(id); }   // service awaits directly
  static find(...args)     { return makeQuery(() => _findFn(...args)); }
}

FakeMobilizationEvent.VALID_TRANSITIONS   = VALID_TRANSITIONS;
FakeMobilizationEvent.MOBILIZATION_STATUSES = [
  'ACTIVE', 'TRANSIT', 'PREPARATION', 'DEPLOYMENT', 'STOOD_DOWN',
];

const modelPath = require.resolve('../../models/MobilizationEvent');
require.cache[modelPath] = {
  id: modelPath, filename: modelPath, loaded: true,
  exports: Object.assign(FakeMobilizationEvent, {
    VALID_TRANSITIONS,
    MOBILIZATION_STATUSES: FakeMobilizationEvent.MOBILIZATION_STATUSES,
  }),
};

// ─── Load service AFTER stubs are in place ───────────────────────────────────

const {
  isUserInMobilizationScope,
  createMobilization,
  advanceMobilizationStatus,
  standDownMobilization,
  getActiveMobilization,
} = require('../mobilizationService');

// ════════════════════════════════════════════════════════════════════════════
// isUserInMobilizationScope — pure function, no DB
// ════════════════════════════════════════════════════════════════════════════

test('isUserInMobilizationScope: unit-only scope — user in same unit matches', () => {
  const scope = { unitId: uid(1), companyId: null, teamId: null };
  assert.ok(isUserInMobilizationScope({ unitId: uid(1) }, scope));
});

test('isUserInMobilizationScope: unit-only scope — different unit does not match', () => {
  const scope = { unitId: uid(1), companyId: null, teamId: null };
  assert.ok(!isUserInMobilizationScope({ unitId: uid(2) }, scope));
});

test('isUserInMobilizationScope: company scope — user in matching company matches', () => {
  const scope = { unitId: uid(1), companyId: uid(10), teamId: null };
  assert.ok(isUserInMobilizationScope({ unitId: uid(1), companyId: uid(10) }, scope));
});

test('isUserInMobilizationScope: company scope — user in different company does not match', () => {
  const scope = { unitId: uid(1), companyId: uid(10), teamId: null };
  assert.ok(!isUserInMobilizationScope({ unitId: uid(1), companyId: uid(99) }, scope));
});

test('isUserInMobilizationScope: team scope — exact match passes', () => {
  const scope = { unitId: uid(1), companyId: uid(10), teamId: uid(100) };
  assert.ok(
    isUserInMobilizationScope({ unitId: uid(1), companyId: uid(10), teamId: uid(100) }, scope)
  );
});

test('isUserInMobilizationScope: team scope — different team does not match', () => {
  const scope = { unitId: uid(1), companyId: uid(10), teamId: uid(100) };
  assert.ok(
    !isUserInMobilizationScope({ unitId: uid(1), companyId: uid(10), teamId: uid(999) }, scope)
  );
});

test('isUserInMobilizationScope: null inputs return false', () => {
  assert.ok(!isUserInMobilizationScope(null, { unitId: uid(1) }));
  assert.ok(!isUserInMobilizationScope({ unitId: uid(1) }, null));
});

// ════════════════════════════════════════════════════════════════════════════
// createMobilization — authority & conflict enforcement
// ════════════════════════════════════════════════════════════════════════════

test('createMobilization: rejects SQUAD_COMMANDER (rank too low)', async () => {
  _findOneFn = async () => null;

  const actor = {
    id: uid(1), role: 'user',
    operationalRole: 'SQUAD_COMMANDER',
    unitId: uid(1), companyId: uid(10), teamId: uid(100),
  };
  const targetScope = { unitId: uid(1), companyId: uid(10), teamId: uid(100) };

  await assert.rejects(
    () => createMobilization({ actor, targetScope }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /TEAM_COMMANDER rank or above/);
      return true;
    }
  );
});

test('createMobilization: TEAM_COMMANDER can mobilize own team', async () => {
  _findOneFn  = async () => null; // no existing mobilization
  _lastSavedDoc = null;

  const actor = {
    id: uid(2), role: 'user',
    operationalRole: 'TEAM_COMMANDER',
    unitId: uid(1), companyId: uid(10), teamId: uid(100),
  };
  const targetScope = { unitId: uid(1), companyId: uid(10), teamId: uid(100) };

  const mob = await createMobilization({ actor, targetScope, incidentDescription: 'Ambush' });

  assert.ok(mob);
  assert.equal(mob.status, 'ACTIVE');
  assert.equal(_lastSavedDoc, mob);
});

test('createMobilization: TEAM_COMMANDER cannot mobilize another team', async () => {
  _findOneFn = async () => null;

  const actor = {
    id: uid(3), role: 'user',
    operationalRole: 'TEAM_COMMANDER',
    unitId: uid(1), companyId: uid(10), teamId: uid(100),
  };
  // targetScope points to a different team
  const targetScope = { unitId: uid(1), companyId: uid(10), teamId: uid(999) };

  await assert.rejects(
    () => createMobilization({ actor, targetScope }),
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});

test('createMobilization: COMPANY_COMMANDER must specify companyId', async () => {
  _findOneFn = async () => null;

  const actor = {
    id: uid(4), role: 'user',
    operationalRole: 'COMPANY_COMMANDER',
    unitId: uid(1), companyId: uid(10),
  };
  const targetScope = { unitId: uid(1) }; // missing companyId

  await assert.rejects(
    () => createMobilization({ actor, targetScope }),
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});

test('createMobilization: COMPANY_COMMANDER can mobilize own company', async () => {
  _findOneFn = async () => null;
  _lastSavedDoc = null;

  const actor = {
    id: uid(5), role: 'user',
    operationalRole: 'COMPANY_COMMANDER',
    unitId: uid(1), companyId: uid(10),
  };
  const targetScope = { unitId: uid(1), companyId: uid(10) };

  const mob = await createMobilization({ actor, targetScope });
  assert.ok(mob);
  assert.equal(mob.status, 'ACTIVE');
});

test('createMobilization: HQ can mobilize any unit', async () => {
  _findOneFn = async () => null;
  _lastSavedDoc = null;

  const actor = {
    id: uid(6), role: 'user',
    operationalRole: 'HQ',
    unitId: uid(1),
  };
  const targetScope = { unitId: uid(1) };

  const mob = await createMobilization({ actor, targetScope });
  assert.ok(mob);
  assert.equal(mob.status, 'ACTIVE');
});

test('createMobilization: 409 when active mobilization already exists for unit', async () => {
  // Simulate an existing active mobilization returned by findOne
  _findOneFn = async () => new FakeMobilizationEvent({ status: 'TRANSIT', targetScope: { unitId: uid(1) } });

  const actor = {
    id: uid(7), role: 'user',
    operationalRole: 'HQ',
    unitId: uid(1),
  };
  const targetScope = { unitId: uid(1) };

  await assert.rejects(
    () => createMobilization({ actor, targetScope }),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /active mobilization already exists/i);
      return true;
    }
  );
});

test('createMobilization: teamId without companyId is rejected (scope consistency)', async () => {
  _findOneFn = async () => null;

  const actor = {
    id: uid(8), role: 'user',
    operationalRole: 'HQ',
    unitId: uid(1),
  };
  const targetScope = { unitId: uid(1), teamId: uid(100) }; // missing companyId

  await assert.rejects(
    () => createMobilization({ actor, targetScope }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /companyId is required/i);
      return true;
    }
  );
});

// ════════════════════════════════════════════════════════════════════════════
// advanceMobilizationStatus — state machine
// ════════════════════════════════════════════════════════════════════════════

test('advanceMobilizationStatus: ACTIVE → TRANSIT is valid', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(20),
    status: 'ACTIVE',
    triggeredBy: uid(9),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;

  const actor = { id: uid(9), role: 'user', operationalRole: 'HQ', unitId: uid(1) };

  const result = await advanceMobilizationStatus({
    mobilizationId: uid(20),
    nextStatus: 'TRANSIT',
    actor,
  });

  assert.equal(result.status, 'TRANSIT');
  assert.equal(_lastSavedDoc.status, 'TRANSIT');
});

test('advanceMobilizationStatus: TRANSIT → PREPARATION is valid', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(21),
    status: 'TRANSIT',
    triggeredBy: uid(9),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;

  const actor = { id: uid(9), role: 'user', operationalRole: 'HQ', unitId: uid(1) };

  const result = await advanceMobilizationStatus({
    mobilizationId: uid(21),
    nextStatus: 'PREPARATION',
    actor,
  });

  assert.equal(result.status, 'PREPARATION');
});

test('advanceMobilizationStatus: ACTIVE → DEPLOYMENT (invalid skip) is rejected', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(22),
    status: 'ACTIVE',
    triggeredBy: uid(9),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;

  const actor = { id: uid(9), role: 'user', operationalRole: 'HQ', unitId: uid(1) };

  await assert.rejects(
    () => advanceMobilizationStatus({ mobilizationId: uid(22), nextStatus: 'DEPLOYMENT', actor }),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.match(err.message, /Cannot transition from ACTIVE to DEPLOYMENT/);
      return true;
    }
  );
});

test('advanceMobilizationStatus: DEPLOYMENT → any (terminal) is rejected', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(23),
    status: 'DEPLOYMENT',
    triggeredBy: uid(9),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;

  const actor = { id: uid(9), role: 'user', operationalRole: 'HQ', unitId: uid(1) };

  await assert.rejects(
    () => advanceMobilizationStatus({ mobilizationId: uid(23), nextStatus: 'ACTIVE', actor }),
    (err) => {
      assert.equal(err.statusCode, 422);
      return true;
    }
  );
});

test('advanceMobilizationStatus: 404 when mobilization not found', async () => {
  _findByIdFn = async () => null;

  const actor = { id: uid(9), role: 'user', operationalRole: 'HQ', unitId: uid(1) };

  await assert.rejects(
    () => advanceMobilizationStatus({ mobilizationId: uid(99), nextStatus: 'TRANSIT', actor }),
    (err) => {
      assert.equal(err.statusCode, 404);
      return true;
    }
  );
});

// ════════════════════════════════════════════════════════════════════════════
// standDownMobilization — authority rules
// ════════════════════════════════════════════════════════════════════════════

test('standDownMobilization: triggerer can stand down', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(30),
    status: 'TRANSIT',
    triggeredBy: uid(10),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;
  _lastSavedDoc = null;

  const actor = { id: uid(10), role: 'user', operationalRole: 'TEAM_COMMANDER', unitId: uid(1), teamId: uid(100), companyId: uid(10) };

  const result = await standDownMobilization({ mobilizationId: uid(30), actor });

  assert.equal(result.status, 'STOOD_DOWN');
  assert.ok(result.stoodDownAt instanceof Date);
  assert.equal(String(result.stoodDownBy), String(actor.id));
});

test('standDownMobilization: HQ can stand down any mobilization', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(31),
    status: 'ACTIVE',
    triggeredBy: uid(11),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;

  const actor = { id: uid(99), role: 'user', operationalRole: 'HQ', unitId: uid(1) };

  const result = await standDownMobilization({ mobilizationId: uid(31), actor });
  assert.equal(result.status, 'STOOD_DOWN');
});

test('standDownMobilization: non-triggerer TEAM_COMMANDER is rejected', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(32),
    status: 'ACTIVE',
    triggeredBy: uid(11),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;

  const actor = { id: uid(50), role: 'user', operationalRole: 'TEAM_COMMANDER', unitId: uid(1), companyId: uid(10), teamId: uid(100) };

  await assert.rejects(
    () => standDownMobilization({ mobilizationId: uid(32), actor }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /Only the triggering commander/);
      return true;
    }
  );
});

test('standDownMobilization: already stood-down mobilization returns 409', async () => {
  const mob = new FakeMobilizationEvent({
    _id: uid(33),
    status: 'STOOD_DOWN',
    triggeredBy: uid(10),
    targetScope: { unitId: uid(1) },
  });
  _findByIdFn = async () => mob;

  const actor = { id: uid(10), role: 'user', operationalRole: 'HQ', unitId: uid(1) };

  await assert.rejects(
    () => standDownMobilization({ mobilizationId: uid(33), actor }),
    (err) => {
      assert.equal(err.statusCode, 409);
      return true;
    }
  );
});

// ════════════════════════════════════════════════════════════════════════════
// getActiveMobilization — scope visibility
// ════════════════════════════════════════════════════════════════════════════

test('getActiveMobilization: admin sees all non-stood-down mobilizations', async () => {
  const docs = [
    new FakeMobilizationEvent({ status: 'ACTIVE',  targetScope: { unitId: uid(1) } }),
    new FakeMobilizationEvent({ status: 'TRANSIT', targetScope: { unitId: uid(2) } }),
  ];

  // _findFn is used by FakeMobilizationEvent.find() via makeQuery
  _findFn = async () => docs;

  const actor = { role: 'admin', operationalRole: 'HQ', unitId: uid(1) };

  const result = await getActiveMobilization(actor);
  assert.equal(result.length, 2);
});

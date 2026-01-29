const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');
const { validateAOCreate } = require('./validators');

const runValidators = async (validators, req) => {
  for (const validator of validators) {
    if (validator && typeof validator.run === 'function') {
      await validator.run(req);
    }
  }
};

const baseBody = {
  name: 'Test AO',
  polygon: {
    type: 'Polygon',
    coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]]
  }
};

test('validateAOCreate allows non-admin without companyId', async () => {
  const req = {
    body: { ...baseBody },
    user: { role: 'user', companyId: '507f1f77bcf86cd799439011' }
  };

  await runValidators(validateAOCreate, req);
  const errors = validationResult(req);

  assert.equal(errors.isEmpty(), true);
});

test('validateAOCreate requires companyId for admin', async () => {
  const req = {
    body: { ...baseBody },
    user: { role: 'admin' }
  };

  await runValidators(validateAOCreate, req);
  const errors = validationResult(req);

  assert.equal(errors.isEmpty(), false);
  const companyErrors = errors.array().filter((error) => error.path === 'companyId');
  assert.ok(companyErrors.length >= 1);
});

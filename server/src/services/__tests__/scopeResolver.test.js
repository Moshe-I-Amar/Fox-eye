const test = require('node:test');
const assert = require('node:assert/strict');

const Squad = require('../../models/Squad');
const Team = require('../../models/Team');
const Company = require('../../models/Company');
const { resolveUserScope } = require('../scopeResolver');

const createFindStub = (docs = []) => {
  const find = (query, projection) => {
    find.calls.push({ query, projection });
    return {
      lean: async () => docs
    };
  };
  find.calls = [];
  return find;
};

const setFindStub = (model, stub) => {
  const original = model.find;
  model.find = stub;
  return () => {
    model.find = original;
  };
};

test('returns empty scope for missing user', async () => {
  const scope = await resolveUserScope(null);

  assert.deepEqual(scope, {
    squads: [],
    teams: [],
    companies: [],
    units: []
  });
});

test('SQUAD_COMMANDER sees only their squad', async () => {
  const restoreSquad = setFindStub(Squad, () => {
    throw new Error('Squad.find should not be called');
  });
  const restoreTeam = setFindStub(Team, () => {
    throw new Error('Team.find should not be called');
  });
  const restoreCompany = setFindStub(Company, () => {
    throw new Error('Company.find should not be called');
  });

  const scope = await resolveUserScope({
    operationalRole: 'SQUAD_COMMANDER',
    squadId: 'squad-1'
  });

  restoreSquad();
  restoreTeam();
  restoreCompany();

  assert.deepEqual(scope, {
    squads: ['squad-1'],
    teams: [],
    companies: [],
    units: []
  });
});

test('SQUAD_COMMANDER with missing squadId has empty scope', async () => {
  const scope = await resolveUserScope({
    operationalRole: 'SQUAD_COMMANDER'
  });

  assert.deepEqual(scope, {
    squads: [],
    teams: [],
    companies: [],
    units: []
  });
});

test('TEAM_COMMANDER sees team and child squads', async () => {
  const squadFind = createFindStub([{ _id: 'squad-a' }, { _id: 'squad-b' }]);
  const restoreSquad = setFindStub(Squad, squadFind);
  const restoreTeam = setFindStub(Team, () => {
    throw new Error('Team.find should not be called');
  });
  const restoreCompany = setFindStub(Company, () => {
    throw new Error('Company.find should not be called');
  });

  const scope = await resolveUserScope({
    operationalRole: 'TEAM_COMMANDER',
    teamId: 'team-1'
  });

  restoreSquad();
  restoreTeam();
  restoreCompany();

  assert.deepEqual(scope, {
    squads: ['squad-a', 'squad-b'],
    teams: ['team-1'],
    companies: [],
    units: []
  });
  assert.equal(squadFind.calls.length, 1);
  assert.deepEqual(squadFind.calls[0].query, { parentId: 'team-1' });
  assert.equal(squadFind.calls[0].projection, '_id');
});

test('TEAM_COMMANDER without teamId does not query squads', async () => {
  const squadFind = createFindStub([{ _id: 'squad-z' }]);
  const restoreSquad = setFindStub(Squad, squadFind);

  const scope = await resolveUserScope({
    operationalRole: 'TEAM_COMMANDER'
  });

  restoreSquad();

  assert.deepEqual(scope, {
    squads: [],
    teams: [],
    companies: [],
    units: []
  });
  assert.equal(squadFind.calls.length, 0);
});

test('COMPANY_COMMANDER sees company, teams, and squads', async () => {
  const teamFind = createFindStub([{ _id: 'team-a' }, { _id: 'team-b' }]);
  const squadFind = createFindStub([{ _id: 'squad-a' }, { _id: 'squad-b' }]);
  const restoreTeam = setFindStub(Team, teamFind);
  const restoreSquad = setFindStub(Squad, squadFind);
  const restoreCompany = setFindStub(Company, () => {
    throw new Error('Company.find should not be called');
  });

  const scope = await resolveUserScope({
    operationalRole: 'COMPANY_COMMANDER',
    companyId: 'company-1'
  });

  restoreTeam();
  restoreSquad();
  restoreCompany();

  assert.deepEqual(scope, {
    squads: ['squad-a', 'squad-b'],
    teams: ['team-a', 'team-b'],
    companies: ['company-1'],
    units: []
  });
  assert.deepEqual(teamFind.calls[0].query, { parentId: 'company-1' });
  assert.deepEqual(squadFind.calls[0].query, { parentId: { $in: ['team-a', 'team-b'] } });
});

test('COMPANY_COMMANDER without companyId does not query teams or squads', async () => {
  const teamFind = createFindStub([{ _id: 'team-x' }]);
  const squadFind = createFindStub([{ _id: 'squad-x' }]);
  const restoreTeam = setFindStub(Team, teamFind);
  const restoreSquad = setFindStub(Squad, squadFind);

  const scope = await resolveUserScope({
    operationalRole: 'COMPANY_COMMANDER'
  });

  restoreTeam();
  restoreSquad();

  assert.deepEqual(scope, {
    squads: [],
    teams: [],
    companies: [],
    units: []
  });
  assert.equal(teamFind.calls.length, 0);
  assert.equal(squadFind.calls.length, 0);
});

test('UNIT_COMMANDER sees unit, companies, teams, and squads', async () => {
  const companyFind = createFindStub([{ _id: 'company-a' }]);
  const teamFind = createFindStub([{ _id: 'team-a' }]);
  const squadFind = createFindStub([{ _id: 'squad-a' }]);
  const restoreCompany = setFindStub(Company, companyFind);
  const restoreTeam = setFindStub(Team, teamFind);
  const restoreSquad = setFindStub(Squad, squadFind);

  const scope = await resolveUserScope({
    operationalRole: 'UNIT_COMMANDER',
    unitId: 'unit-1'
  });

  restoreCompany();
  restoreTeam();
  restoreSquad();

  assert.deepEqual(scope, {
    squads: ['squad-a'],
    teams: ['team-a'],
    companies: ['company-a'],
    units: ['unit-1']
  });
  assert.deepEqual(companyFind.calls[0].query, { parentId: 'unit-1' });
  assert.deepEqual(teamFind.calls[0].query, { parentId: { $in: ['company-a'] } });
  assert.deepEqual(squadFind.calls[0].query, { parentId: { $in: ['team-a'] } });
});

test('HQ role matches UNIT_COMMANDER visibility', async () => {
  const companyFind = createFindStub([{ _id: 'company-a' }, { _id: 'company-b' }]);
  const teamFind = createFindStub([{ _id: 'team-a' }]);
  const squadFind = createFindStub([{ _id: 'squad-a' }]);
  const restoreCompany = setFindStub(Company, companyFind);
  const restoreTeam = setFindStub(Team, teamFind);
  const restoreSquad = setFindStub(Squad, squadFind);

  const scope = await resolveUserScope({
    operationalRole: 'HQ',
    unitId: 'unit-9'
  });

  restoreCompany();
  restoreTeam();
  restoreSquad();

  assert.deepEqual(scope, {
    squads: ['squad-a'],
    teams: ['team-a'],
    companies: ['company-a', 'company-b'],
    units: ['unit-9']
  });
});

test('Unknown role falls back to squad visibility', async () => {
  const scope = await resolveUserScope({
    operationalRole: 'UNKNOWN_ROLE',
    squadId: 'squad-9'
  });

  assert.deepEqual(scope, {
    squads: ['squad-9'],
    teams: [],
    companies: [],
    units: []
  });
});

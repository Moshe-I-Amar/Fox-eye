const toIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'object') {
    if (value._id) {
      return String(value._id);
    }
    if (value.id) {
      return String(value.id);
    }
  }

  return null;
};

const normalizeScopeValues = (values = []) => {
  const unique = new Map();

  values.forEach((value) => {
    if (!value) {
      return;
    }

    if (typeof value === 'object') {
      if (value._id) {
        unique.set(String(value._id), value._id);
        return;
      }
      if (value.id) {
        unique.set(String(value.id), value.id);
        return;
      }
    }

    unique.set(String(value), value);
  });

  return Array.from(unique.values());
};

const normalizeScope = (scope) => {
  const mapToSet = (values = []) => {
    const ids = values.map(toIdString).filter(Boolean);
    return new Set(ids);
  };

  return {
    squads: mapToSet(scope?.squads),
    teams: mapToSet(scope?.teams),
    companies: mapToSet(scope?.companies),
    units: mapToSet(scope?.units)
  };
};

const hasScopeAccess = (item, scopeSets) => {
  const squadId = toIdString(item?.squadId);
  const teamId = toIdString(item?.teamId);
  const companyId = toIdString(item?.companyId);
  const unitId = toIdString(item?.unitId);

  return (
    (squadId && scopeSets.squads.has(squadId)) ||
    (teamId && scopeSets.teams.has(teamId)) ||
    (companyId && scopeSets.companies.has(companyId)) ||
    (unitId && scopeSets.units.has(unitId))
  );
};

const filterByScope = (items, scope) => {
  if (!Array.isArray(items)) {
    return [];
  }

  const scopeSets = normalizeScope(scope);
  const hasAnyScope =
    scopeSets.squads.size ||
    scopeSets.teams.size ||
    scopeSets.companies.size ||
    scopeSets.units.size;

  if (!hasAnyScope) {
    return [];
  }

  return items.filter((item) => hasScopeAccess(item, scopeSets));
};

const filterUsersByScope = (users, scope) => filterByScope(users, scope);

const filterAssetsByScope = (assets, scope) => filterByScope(assets, scope);

const filterEventsByScope = (events, scope) => filterByScope(events, scope);

const buildScopeQuery = (scope) => {
  const squads = normalizeScopeValues(scope?.squads);
  const teams = normalizeScopeValues(scope?.teams);
  const companies = normalizeScopeValues(scope?.companies);
  const units = normalizeScopeValues(scope?.units);
  const clauses = [];

  if (squads.length) {
    clauses.push({ squadId: { $in: squads } });
  }
  if (teams.length) {
    clauses.push({ teamId: { $in: teams } });
  }
  if (companies.length) {
    clauses.push({ companyId: { $in: companies } });
  }
  if (units.length) {
    clauses.push({ unitId: { $in: units } });
  }

  if (!clauses.length) {
    return null;
  }

  return { $or: clauses };
};

module.exports = {
  filterUsersByScope,
  filterAssetsByScope,
  filterEventsByScope,
  buildScopeQuery
};

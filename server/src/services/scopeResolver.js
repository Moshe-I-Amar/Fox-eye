const Squad = require('../models/Squad');
const Team = require('../models/Team');
const Company = require('../models/Company');

const emptyScope = () => ({
  squads: [],
  teams: [],
  companies: [],
  units: []
});

const extractIds = (docs) => docs.map((doc) => doc._id);

const resolveUserScope = async (user) => {
  if (!user) {
    return emptyScope();
  }

  const scope = emptyScope();
  const role = user.operationalRole || 'SQUAD_COMMANDER';

  if (role === 'SQUAD_COMMANDER') {
    return {
      ...scope,
      squads: user.squadId ? [user.squadId] : []
    };
  }

  if (role === 'TEAM_COMMANDER') {
    const squadDocs = user.teamId
      ? await Squad.find({ parentId: user.teamId }, '_id').lean()
      : [];

    return {
      ...scope,
      squads: extractIds(squadDocs),
      teams: user.teamId ? [user.teamId] : []
    };
  }

  if (role === 'COMPANY_COMMANDER') {
    const teamDocs = user.companyId
      ? await Team.find({ parentId: user.companyId }, '_id').lean()
      : [];
    const teamIds = extractIds(teamDocs);
    const squadDocs = teamIds.length
      ? await Squad.find({ parentId: { $in: teamIds } }, '_id').lean()
      : [];

    return {
      ...scope,
      squads: extractIds(squadDocs),
      teams: teamIds,
      companies: user.companyId ? [user.companyId] : []
    };
  }

  if (role === 'UNIT_COMMANDER' || role === 'HQ') {
    const companyDocs = user.unitId
      ? await Company.find({ parentId: user.unitId }, '_id').lean()
      : [];
    const companyIds = extractIds(companyDocs);
    const teamDocs = companyIds.length
      ? await Team.find({ parentId: { $in: companyIds } }, '_id').lean()
      : [];
    const teamIds = extractIds(teamDocs);
    const squadDocs = teamIds.length
      ? await Squad.find({ parentId: { $in: teamIds } }, '_id').lean()
      : [];

    return {
      ...scope,
      squads: extractIds(squadDocs),
      teams: teamIds,
      companies: companyIds,
      units: user.unitId ? [user.unitId] : []
    };
  }

  return {
    ...scope,
    squads: user.squadId ? [user.squadId] : []
  };
};

module.exports = {
  resolveUserScope
};

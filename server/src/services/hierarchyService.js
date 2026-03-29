const Unit = require('../models/Unit');
const Company = require('../models/Company');
const Team = require('../models/Team');
const Squad = require('../models/Squad');
const User = require('../models/User');
const { AppError } = require('../utils/errors');

/**
 * Resolves a full hierarchy path from provided IDs.
 * All four IDs are required. Validates parent-child relationships.
 * Used by admin operations where explicit IDs must be supplied.
 */
const resolveHierarchyPath = async ({ unitId, companyId, teamId, squadId }) => {
  if (!unitId || !companyId || !teamId || !squadId) {
    throw new AppError('VALIDATION_ERROR', 'Unit, company, team, and squad are required', 400);
  }

  const unit = await Unit.findOne({ _id: unitId, active: true }).lean();
  if (!unit) {
    throw new AppError('HIERARCHY_UNIT_NOT_FOUND', 'Unit not found', 400);
  }

  const company = await Company.findOne({ _id: companyId, active: true }).lean();
  if (!company) {
    throw new AppError('HIERARCHY_COMPANY_NOT_FOUND', 'Company not found', 400);
  }
  if (String(company.parentId) !== String(unit._id)) {
    throw new AppError('HIERARCHY_COMPANY_MISMATCH', 'Company does not belong to the selected unit', 400);
  }

  const team = await Team.findOne({ _id: teamId, active: true }).lean();
  if (!team) {
    throw new AppError('HIERARCHY_TEAM_NOT_FOUND', 'Team not found', 400);
  }
  if (String(team.parentId) !== String(company._id)) {
    throw new AppError('HIERARCHY_TEAM_MISMATCH', 'Team does not belong to the selected company', 400);
  }

  const squad = await Squad.findOne({ _id: squadId, active: true }).lean();
  if (!squad) {
    throw new AppError('HIERARCHY_SQUAD_NOT_FOUND', 'Squad not found', 400);
  }
  if (String(squad.parentId) !== String(team._id)) {
    throw new AppError('HIERARCHY_SQUAD_MISMATCH', 'Squad does not belong to the selected team', 400);
  }

  return {
    unitId: unit._id,
    companyId: company._id,
    teamId: team._id,
    squadId: squad._id
  };
};

/**
 * Resolves a hierarchy path for user registration.
 * IDs are optional — falls back to the first active node at each level.
 * Used by the auth register flow where users may not supply explicit IDs.
 */
const resolveHierarchyForRegistration = async ({ unitId, companyId, teamId, squadId }) => {
  const unit = unitId
    ? await Unit.findOne({ _id: unitId, active: true }).lean()
    : await Unit.findOne({ active: true }).sort({ createdAt: 1 }).lean();

  if (!unit) {
    throw new AppError('HIERARCHY_UNIT_NOT_FOUND', 'Unit not found for registration', 400);
  }

  const company = companyId
    ? await Company.findOne({ _id: companyId, active: true }).lean()
    : await Company.findOne({ parentId: unit._id, active: true }).sort({ createdAt: 1 }).lean();

  if (!company) {
    throw new AppError('HIERARCHY_COMPANY_NOT_FOUND', 'Company not found for registration', 400);
  }
  if (String(company.parentId) !== String(unit._id)) {
    throw new AppError('HIERARCHY_COMPANY_MISMATCH', 'Company does not belong to the selected unit', 400);
  }

  const team = teamId
    ? await Team.findOne({ _id: teamId, active: true }).lean()
    : await Team.findOne({ parentId: company._id, active: true }).sort({ createdAt: 1 }).lean();

  if (!team) {
    throw new AppError('HIERARCHY_TEAM_NOT_FOUND', 'Team not found for registration', 400);
  }
  if (String(team.parentId) !== String(company._id)) {
    throw new AppError('HIERARCHY_TEAM_MISMATCH', 'Team does not belong to the selected company', 400);
  }

  const squad = squadId
    ? await Squad.findOne({ _id: squadId, active: true }).lean()
    : await Squad.findOne({ parentId: team._id, active: true }).sort({ createdAt: 1 }).lean();

  if (!squad) {
    throw new AppError('HIERARCHY_SQUAD_NOT_FOUND', 'Squad not found for registration', 400);
  }
  if (String(squad.parentId) !== String(team._id)) {
    throw new AppError('HIERARCHY_SQUAD_MISMATCH', 'Squad does not belong to the selected team', 400);
  }

  return {
    unitId: unit._id,
    companyId: company._id,
    teamId: team._id,
    squadId: squad._id
  };
};

/**
 * Ensures a hierarchy node has no active children or users before deactivation.
 * Throws if any active descendants exist.
 */
const ensureNoActiveChildren = async (type, id) => {
  if (type === 'company') {
    const activeTeam = await Team.findOne({ parentId: id, active: true }).lean();
    if (activeTeam) {
      throw new AppError('HIERARCHY_HAS_ACTIVE_CHILDREN', 'Company has active teams', 409);
    }
    const teamIds = (await Team.find({ parentId: id }, '_id').lean()).map((t) => t._id);
    if (teamIds.length) {
      const activeSquad = await Squad.findOne({ parentId: { $in: teamIds }, active: true }).lean();
      if (activeSquad) {
        throw new AppError('HIERARCHY_HAS_ACTIVE_CHILDREN', 'Company has active squads', 409);
      }
    }
    const activeUser = await User.findOne({ companyId: id, active: true }).lean();
    if (activeUser) {
      throw new AppError('HIERARCHY_HAS_ACTIVE_CHILDREN', 'Company has active users', 409);
    }
    return;
  }

  if (type === 'team') {
    const activeSquad = await Squad.findOne({ parentId: id, active: true }).lean();
    if (activeSquad) {
      throw new AppError('HIERARCHY_HAS_ACTIVE_CHILDREN', 'Team has active squads', 409);
    }
    const activeUser = await User.findOne({ teamId: id, active: true }).lean();
    if (activeUser) {
      throw new AppError('HIERARCHY_HAS_ACTIVE_CHILDREN', 'Team has active users', 409);
    }
    return;
  }

  if (type === 'squad') {
    const activeUser = await User.findOne({ squadId: id, active: true }).lean();
    if (activeUser) {
      throw new AppError('HIERARCHY_HAS_ACTIVE_CHILDREN', 'Squad has active users', 409);
    }
  }
};

/**
 * Fetches all hierarchy nodes in parallel for tree display.
 */
const getHierarchyTree = async () => {
  const [units, companies, teams, squads] = await Promise.all([
    Unit.find().sort({ name: 1 }).lean(),
    Company.find().sort({ name: 1 }).lean(),
    Team.find().sort({ name: 1 }).lean(),
    Squad.find().sort({ name: 1 }).lean()
  ]);
  return { units, companies, teams, squads };
};

module.exports = {
  resolveHierarchyPath,
  resolveHierarchyForRegistration,
  ensureNoActiveChildren,
  getHierarchyTree
};

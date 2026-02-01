const crypto = require('crypto');
const Unit = require('../models/Unit');
const Company = require('../models/Company');
const Team = require('../models/Team');
const Squad = require('../models/Squad');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { OPERATIONAL_ROLES } = require('../utils/roles');
const { logAdminAction } = require('../services/adminAuditService');

const isCompanyCommander = (user) => user?.operationalRole === 'COMPANY_COMMANDER';
const sanitizeUserSnapshot = (snapshot) => {
  if (!snapshot) {
    return snapshot;
  }
  const { password, ...rest } = snapshot;
  return rest;
};

const ensureCompanyAccess = (user, companyId) => {
  if (!isCompanyCommander(user)) {
    return;
  }

  if (!companyId || !user?.companyId || String(companyId) !== String(user.companyId)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }
};

const ensureCompanyAccessFromTeam = async (user, teamId) => {
  if (!isCompanyCommander(user)) {
    return null;
  }
  if (!teamId) {
    throw new AppError('VALIDATION_ERROR', 'Team ID is required', 400);
  }
  const team = await Team.findById(teamId).lean();
  if (!team) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }
  ensureCompanyAccess(user, team.parentId);
  return team;
};

const ensureCompanyAccessFromSquad = async (user, squadId) => {
  if (!isCompanyCommander(user)) {
    return null;
  }
  if (!squadId) {
    throw new AppError('VALIDATION_ERROR', 'Squad ID is required', 400);
  }
  const squad = await Squad.findById(squadId).lean();
  if (!squad) {
    throw new AppError('NOT_FOUND', 'Squad not found', 404);
  }
  const team = await Team.findById(squad.parentId).lean();
  if (!team) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }
  ensureCompanyAccess(user, team.parentId);
  return { squad, team };
};

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

const ensureNoActiveChildren = async (type, id) => {
  if (type === 'company') {
    const activeTeam = await Team.findOne({ parentId: id, active: true }).lean();
    if (activeTeam) {
      throw new AppError('HIERARCHY_HAS_ACTIVE_CHILDREN', 'Company has active teams', 409);
    }
    const activeTeamIds = await Team.find({ parentId: id }, '_id').lean();
    const teamIds = activeTeamIds.map((team) => team._id);
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

const createCompany = asyncHandler(async (req, res) => {
  const { name, commanderId, unitId, active = true } = req.body;

  if (!name) {
    throw new AppError('VALIDATION_ERROR', 'Name is required', 400);
  }

  if (!unitId) {
    throw new AppError('VALIDATION_ERROR', 'Unit ID is required', 400);
  }

  const unit = await Unit.findOne({ _id: unitId, active: true }).lean();
  if (!unit) {
    throw new AppError('HIERARCHY_UNIT_NOT_FOUND', 'Unit not found', 400);
  }

  const company = await Company.create({
    name,
    commanderId: commanderId || null,
    parentId: unit._id,
    active: active !== undefined ? !!active : true
  });

  await logAdminAction({
    action: 'company.create',
    actorUserId: req.user.id,
    targetType: 'company',
    targetId: company._id,
    before: null,
    after: company.toObject()
  });

  res.status(201).json({
    success: true,
    data: { company }
  });
});

const updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    throw new AppError('NOT_FOUND', 'Company not found', 404);
  }

  ensureCompanyAccess(req.user, company._id);

  const before = company.toObject();
  const { name, commanderId, active } = req.body;
  const updates = {};

  if (name !== undefined) {
    updates.name = name;
  }
  if (commanderId !== undefined) {
    updates.commanderId = commanderId;
  }
  if (active !== undefined) {
    if (!active) {
      await ensureNoActiveChildren('company', company._id);
    }
    updates.active = !!active;
  }

  if (!Object.keys(updates).length) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  const updatedCompany = await Company.findByIdAndUpdate(
    company._id,
    updates,
    { new: true, runValidators: true }
  );

  await logAdminAction({
    action: 'company.update',
    actorUserId: req.user.id,
    targetType: 'company',
    targetId: company._id,
    before,
    after: updatedCompany.toObject()
  });

  res.json({
    success: true,
    data: { company: updatedCompany }
  });
});

const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    throw new AppError('NOT_FOUND', 'Company not found', 404);
  }

  ensureCompanyAccess(req.user, company._id);
  await ensureNoActiveChildren('company', company._id);

  const before = company.toObject();
  company.active = false;
  await company.save();

  await logAdminAction({
    action: 'company.deactivate',
    actorUserId: req.user.id,
    targetType: 'company',
    targetId: company._id,
    before,
    after: company.toObject()
  });

  res.json({
    success: true,
    data: { company }
  });
});

const createTeam = asyncHandler(async (req, res) => {
  const { name, companyId, commanderId, active = true } = req.body;

  if (!name) {
    throw new AppError('VALIDATION_ERROR', 'Name is required', 400);
  }
  if (!companyId) {
    throw new AppError('VALIDATION_ERROR', 'Company ID is required', 400);
  }

  ensureCompanyAccess(req.user, companyId);

  const company = await Company.findOne({ _id: companyId, active: true }).lean();
  if (!company) {
    throw new AppError('HIERARCHY_COMPANY_NOT_FOUND', 'Company not found', 400);
  }

  const team = await Team.create({
    name,
    commanderId: commanderId || null,
    parentId: company._id,
    active: active !== undefined ? !!active : true
  });

  await logAdminAction({
    action: 'team.create',
    actorUserId: req.user.id,
    targetType: 'team',
    targetId: team._id,
    before: null,
    after: team.toObject()
  });

  res.status(201).json({
    success: true,
    data: { team }
  });
});

const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }

  if (isCompanyCommander(req.user)) {
    ensureCompanyAccess(req.user, team.parentId);
  }

  const before = team.toObject();
  const { name, commanderId, active, companyId } = req.body;
  const updates = {};

  if (name !== undefined) {
    updates.name = name;
  }
  if (commanderId !== undefined) {
    updates.commanderId = commanderId;
  }
  if (companyId !== undefined) {
    if (isCompanyCommander(req.user)) {
      ensureCompanyAccess(req.user, companyId);
    }
    const company = await Company.findOne({ _id: companyId, active: true }).lean();
    if (!company) {
      throw new AppError('HIERARCHY_COMPANY_NOT_FOUND', 'Company not found', 400);
    }
    updates.parentId = company._id;
  }
  if (active !== undefined) {
    if (!active) {
      await ensureNoActiveChildren('team', team._id);
    }
    updates.active = !!active;
  }

  if (!Object.keys(updates).length) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  const updatedTeam = await Team.findByIdAndUpdate(
    team._id,
    updates,
    { new: true, runValidators: true }
  );

  await logAdminAction({
    action: 'team.update',
    actorUserId: req.user.id,
    targetType: 'team',
    targetId: team._id,
    before,
    after: updatedTeam.toObject()
  });

  res.json({
    success: true,
    data: { team: updatedTeam }
  });
});

const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }

  if (isCompanyCommander(req.user)) {
    ensureCompanyAccess(req.user, team.parentId);
  }

  await ensureNoActiveChildren('team', team._id);
  const before = team.toObject();
  team.active = false;
  await team.save();

  await logAdminAction({
    action: 'team.deactivate',
    actorUserId: req.user.id,
    targetType: 'team',
    targetId: team._id,
    before,
    after: team.toObject()
  });

  res.json({
    success: true,
    data: { team }
  });
});

const createSquad = asyncHandler(async (req, res) => {
  const { name, teamId, commanderId, active = true } = req.body;

  if (!name) {
    throw new AppError('VALIDATION_ERROR', 'Name is required', 400);
  }
  if (!teamId) {
    throw new AppError('VALIDATION_ERROR', 'Team ID is required', 400);
  }

  const team = await ensureCompanyAccessFromTeam(req.user, teamId);
  const teamDoc = team || await Team.findOne({ _id: teamId, active: true }).lean();
  if (!teamDoc || teamDoc.active === false) {
    throw new AppError('HIERARCHY_TEAM_NOT_FOUND', 'Team not found', 400);
  }

  const squad = await Squad.create({
    name,
    commanderId: commanderId || null,
    parentId: teamDoc._id,
    active: active !== undefined ? !!active : true
  });

  await logAdminAction({
    action: 'squad.create',
    actorUserId: req.user.id,
    targetType: 'squad',
    targetId: squad._id,
    before: null,
    after: squad.toObject()
  });

  res.status(201).json({
    success: true,
    data: { squad }
  });
});

const updateSquad = asyncHandler(async (req, res) => {
  const squad = await Squad.findById(req.params.id);
  if (!squad) {
    throw new AppError('NOT_FOUND', 'Squad not found', 404);
  }

  if (isCompanyCommander(req.user)) {
    await ensureCompanyAccessFromSquad(req.user, squad._id);
  }

  const before = squad.toObject();
  const { name, commanderId, active, teamId } = req.body;
  const updates = {};

  if (name !== undefined) {
    updates.name = name;
  }
  if (commanderId !== undefined) {
    updates.commanderId = commanderId;
  }
  if (teamId !== undefined) {
    const team = await Team.findOne({ _id: teamId, active: true }).lean();
    if (!team) {
      throw new AppError('HIERARCHY_TEAM_NOT_FOUND', 'Team not found', 400);
    }
    if (isCompanyCommander(req.user)) {
      ensureCompanyAccess(req.user, team.parentId);
    }
    updates.parentId = team._id;
  }
  if (active !== undefined) {
    if (!active) {
      await ensureNoActiveChildren('squad', squad._id);
    }
    updates.active = !!active;
  }

  if (!Object.keys(updates).length) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  const updatedSquad = await Squad.findByIdAndUpdate(
    squad._id,
    updates,
    { new: true, runValidators: true }
  );

  await logAdminAction({
    action: 'squad.update',
    actorUserId: req.user.id,
    targetType: 'squad',
    targetId: squad._id,
    before,
    after: updatedSquad.toObject()
  });

  res.json({
    success: true,
    data: { squad: updatedSquad }
  });
});

const deleteSquad = asyncHandler(async (req, res) => {
  const squad = await Squad.findById(req.params.id);
  if (!squad) {
    throw new AppError('NOT_FOUND', 'Squad not found', 404);
  }

  if (isCompanyCommander(req.user)) {
    await ensureCompanyAccessFromSquad(req.user, squad._id);
  }

  await ensureNoActiveChildren('squad', squad._id);
  const before = squad.toObject();
  squad.active = false;
  await squad.save();

  await logAdminAction({
    action: 'squad.deactivate',
    actorUserId: req.user.id,
    targetType: 'squad',
    targetId: squad._id,
    before,
    after: squad.toObject()
  });

  res.json({
    success: true,
    data: { squad }
  });
});

const listAdminHierarchyTree = asyncHandler(async (req, res) => {
  const [units, companies, teams, squads] = await Promise.all([
    Unit.find().sort({ name: 1 }).lean(),
    Company.find().sort({ name: 1 }).lean(),
    Team.find().sort({ name: 1 }).lean(),
    Squad.find().sort({ name: 1 }).lean()
  ]);

  res.json({
    success: true,
    data: {
      units,
      companies,
      teams,
      squads
    }
  });
});

const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    operationalRole,
    unitId,
    companyId,
    teamId,
    squadId,
    active
  } = req.body;

  if (!name || !email) {
    throw new AppError('VALIDATION_ERROR', 'Name and email are required', 400);
  }

  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) {
    throw new AppError('USER_EXISTS', 'User already exists with this email', 400);
  }

  const hierarchy = await resolveHierarchyPath({
    unitId,
    companyId,
    teamId,
    squadId
  });

  ensureCompanyAccess(req.user, hierarchy.companyId);

  let nextRole;
  let nextOperationalRole;
  if (role) {
    if (['admin', 'user'].includes(role)) {
      nextRole = role;
    } else if (OPERATIONAL_ROLES.includes(role)) {
      nextOperationalRole = role;
    } else {
      throw new AppError('VALIDATION_ERROR', 'Role is invalid', 400);
    }
  }
  if (operationalRole) {
    if (!OPERATIONAL_ROLES.includes(operationalRole)) {
      throw new AppError('VALIDATION_ERROR', 'Operational role is invalid', 400);
    }
    nextOperationalRole = operationalRole;
  }

  let tempPassword = null;
  const assignedPassword = password || (() => {
    const seed = crypto.randomBytes(12).toString('base64');
    tempPassword = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    return tempPassword;
  })();

  const user = await User.create({
    name,
    email,
    password: assignedPassword,
    role: nextRole,
    operationalRole: nextOperationalRole,
    unitId: hierarchy.unitId,
    companyId: hierarchy.companyId,
    teamId: hierarchy.teamId,
    squadId: hierarchy.squadId,
    active: active !== undefined ? !!active : true
  });

  await logAdminAction({
    action: 'user.create',
    actorUserId: req.user.id,
    targetType: 'user',
    targetId: user._id,
    before: null,
    after: sanitizeUserSnapshot(user.toObject())
  });

  res.status(201).json({
    success: true,
    data: {
      user,
      tempPassword: tempPassword || undefined
    },
    message: tempPassword ? 'Temporary password generated' : undefined
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  const before = sanitizeUserSnapshot(user.toObject());
  const {
    name,
    email,
    role,
    operationalRole,
    unitId,
    companyId,
    teamId,
    squadId,
    active
  } = req.body;

  const updates = {};

  if (name !== undefined) {
    updates.name = name;
  }
  if (email !== undefined) {
    const existingUser = await User.findOne({ email, _id: { $ne: user._id } }).lean();
    if (existingUser) {
      throw new AppError('USER_EXISTS', 'User already exists with this email', 400);
    }
    updates.email = email;
  }
  if (active !== undefined) {
    updates.active = !!active;
  }

  if (role !== undefined) {
    if (['admin', 'user'].includes(role)) {
      updates.role = role;
    } else if (OPERATIONAL_ROLES.includes(role)) {
      updates.operationalRole = role;
    } else {
      throw new AppError('VALIDATION_ERROR', 'Role is invalid', 400);
    }
  }
  if (operationalRole !== undefined) {
    if (!OPERATIONAL_ROLES.includes(operationalRole)) {
      throw new AppError('VALIDATION_ERROR', 'Operational role is invalid', 400);
    }
    updates.operationalRole = operationalRole;
  }

  const hasHierarchyUpdate =
    unitId !== undefined || companyId !== undefined || teamId !== undefined || squadId !== undefined;

  if (hasHierarchyUpdate) {
    const hierarchy = await resolveHierarchyPath({
      unitId,
      companyId,
      teamId,
      squadId
    });
    updates.unitId = hierarchy.unitId;
    updates.companyId = hierarchy.companyId;
    updates.teamId = hierarchy.teamId;
    updates.squadId = hierarchy.squadId;
  }

  const companyScopeId = updates.companyId || user.companyId;
  ensureCompanyAccess(req.user, companyScopeId);

  if (!Object.keys(updates).length) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    updates,
    { new: true, runValidators: true }
  );

  await logAdminAction({
    action: 'user.update',
    actorUserId: req.user.id,
    targetType: 'user',
    targetId: user._id,
    before,
    after: sanitizeUserSnapshot(updatedUser.toObject())
  });

  res.json({
    success: true,
    data: { user: updatedUser }
  });
});

const setUserActive = asyncHandler(async (req, res) => {
  const { active } = req.body;
  if (active === undefined) {
    throw new AppError('VALIDATION_ERROR', 'Active is required', 400);
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  ensureCompanyAccess(req.user, user.companyId);

  const before = sanitizeUserSnapshot(user.toObject());
  user.active = !!active;
  await user.save();

  await logAdminAction({
    action: active ? 'user.activate' : 'user.deactivate',
    actorUserId: req.user.id,
    targetType: 'user',
    targetId: user._id,
    before,
    after: sanitizeUserSnapshot(user.toObject())
  });

  res.json({
    success: true,
    data: { user }
  });
});

module.exports = {
  listAdminHierarchyTree,
  createCompany,
  updateCompany,
  deleteCompany,
  createTeam,
  updateTeam,
  deleteTeam,
  createSquad,
  updateSquad,
  deleteSquad,
  createUser,
  updateUser,
  setUserActive
};

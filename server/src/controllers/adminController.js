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
const { withTransaction } = require('../utils/withTransaction');
const {
  resolveHierarchyPath,
  ensureNoActiveChildren,
  getHierarchyTree
} = require('../services/hierarchyService');
const {
  isCompanyCommander,
  assertCompanyAccess,
  assertCompanyAccessFromTeam,
  assertCompanyAccessFromSquad
} = require('../middleware/authorize');

const sanitizeUserSnapshot = (snapshot) => {
  if (!snapshot) return snapshot;
  const { password, ...rest } = snapshot;
  return rest;
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

  const company = await withTransaction(async (session) => {
    const [doc] = await Company.create(
      [{ name, commanderId: commanderId || null, parentId: unit._id, active: active !== undefined ? !!active : true }],
      { session }
    );
    await logAdminAction({
      action: 'company.create',
      actorUserId: req.user.id,
      targetType: 'company',
      targetId: doc._id,
      before: null,
      after: doc.toObject(),
      session
    });
    return doc;
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

  assertCompanyAccess(req.user, company._id);

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

  const updatedCompany = await withTransaction(async (session) => {
    const doc = await Company.findByIdAndUpdate(
      company._id,
      updates,
      { new: true, runValidators: true, session }
    );
    await logAdminAction({
      action: 'company.update',
      actorUserId: req.user.id,
      targetType: 'company',
      targetId: company._id,
      before,
      after: doc.toObject(),
      session
    });
    return doc;
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

  assertCompanyAccess(req.user, company._id);
  await ensureNoActiveChildren('company', company._id);

  const before = company.toObject();

  await withTransaction(async (session) => {
    company.active = false;
    await company.save({ session });
    await logAdminAction({
      action: 'company.deactivate',
      actorUserId: req.user.id,
      targetType: 'company',
      targetId: company._id,
      before,
      after: company.toObject(),
      session
    });
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

  assertCompanyAccess(req.user, companyId);

  const company = await Company.findOne({ _id: companyId, active: true }).lean();
  if (!company) {
    throw new AppError('HIERARCHY_COMPANY_NOT_FOUND', 'Company not found', 400);
  }

  const team = await withTransaction(async (session) => {
    const [doc] = await Team.create(
      [{ name, commanderId: commanderId || null, parentId: company._id, active: active !== undefined ? !!active : true }],
      { session }
    );
    await logAdminAction({
      action: 'team.create',
      actorUserId: req.user.id,
      targetType: 'team',
      targetId: doc._id,
      before: null,
      after: doc.toObject(),
      session
    });
    return doc;
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
    assertCompanyAccess(req.user, team.parentId);
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
      assertCompanyAccess(req.user, companyId);
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

  const updatedTeam = await withTransaction(async (session) => {
    const doc = await Team.findByIdAndUpdate(
      team._id,
      updates,
      { new: true, runValidators: true, session }
    );
    await logAdminAction({
      action: 'team.update',
      actorUserId: req.user.id,
      targetType: 'team',
      targetId: team._id,
      before,
      after: doc.toObject(),
      session
    });
    return doc;
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
    assertCompanyAccess(req.user, team.parentId);
  }

  await ensureNoActiveChildren('team', team._id);
  const before = team.toObject();

  await withTransaction(async (session) => {
    team.active = false;
    await team.save({ session });
    await logAdminAction({
      action: 'team.deactivate',
      actorUserId: req.user.id,
      targetType: 'team',
      targetId: team._id,
      before,
      after: team.toObject(),
      session
    });
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

  const teamDoc = await assertCompanyAccessFromTeam(req.user, teamId) || await Team.findOne({ _id: teamId, active: true }).lean();
  if (!teamDoc || teamDoc.active === false) {
    throw new AppError('HIERARCHY_TEAM_NOT_FOUND', 'Team not found', 400);
  }

  const squad = await withTransaction(async (session) => {
    const [doc] = await Squad.create(
      [{ name, commanderId: commanderId || null, parentId: teamDoc._id, active: active !== undefined ? !!active : true }],
      { session }
    );
    await logAdminAction({
      action: 'squad.create',
      actorUserId: req.user.id,
      targetType: 'squad',
      targetId: doc._id,
      before: null,
      after: doc.toObject(),
      session
    });
    return doc;
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
    await assertCompanyAccessFromSquad(req.user, squad._id);
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
      assertCompanyAccess(req.user, team.parentId);
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

  const updatedSquad = await withTransaction(async (session) => {
    const doc = await Squad.findByIdAndUpdate(
      squad._id,
      updates,
      { new: true, runValidators: true, session }
    );
    await logAdminAction({
      action: 'squad.update',
      actorUserId: req.user.id,
      targetType: 'squad',
      targetId: squad._id,
      before,
      after: doc.toObject(),
      session
    });
    return doc;
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
    await assertCompanyAccessFromSquad(req.user, squad._id);
  }

  await ensureNoActiveChildren('squad', squad._id);
  const before = squad.toObject();

  await withTransaction(async (session) => {
    squad.active = false;
    await squad.save({ session });
    await logAdminAction({
      action: 'squad.deactivate',
      actorUserId: req.user.id,
      targetType: 'squad',
      targetId: squad._id,
      before,
      after: squad.toObject(),
      session
    });
  });

  res.json({
    success: true,
    data: { squad }
  });
});

const listAdminHierarchyTree = asyncHandler(async (req, res) => {
  const tree = await getHierarchyTree();
  res.json({ success: true, data: tree });
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

  const hierarchy = await resolveHierarchyPath({ unitId, companyId, teamId, squadId });
  assertCompanyAccess(req.user, hierarchy.companyId);

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

  const user = await withTransaction(async (session) => {
    const [doc] = await User.create(
      [{
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
      }],
      { session }
    );
    await logAdminAction({
      action: 'user.create',
      actorUserId: req.user.id,
      targetType: 'user',
      targetId: doc._id,
      before: null,
      after: sanitizeUserSnapshot(doc.toObject()),
      session
    });
    return doc;
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
    const hierarchy = await resolveHierarchyPath({ unitId, companyId, teamId, squadId });
    updates.unitId = hierarchy.unitId;
    updates.companyId = hierarchy.companyId;
    updates.teamId = hierarchy.teamId;
    updates.squadId = hierarchy.squadId;
  }

  const companyScopeId = updates.companyId || user.companyId;
  assertCompanyAccess(req.user, companyScopeId);

  if (!Object.keys(updates).length) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  const updatedUser = await withTransaction(async (session) => {
    const doc = await User.findByIdAndUpdate(
      user._id,
      updates,
      { new: true, runValidators: true, session }
    );
    await logAdminAction({
      action: 'user.update',
      actorUserId: req.user.id,
      targetType: 'user',
      targetId: user._id,
      before,
      after: sanitizeUserSnapshot(doc.toObject()),
      session
    });
    return doc;
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

  assertCompanyAccess(req.user, user.companyId);

  const before = sanitizeUserSnapshot(user.toObject());

  await withTransaction(async (session) => {
    user.active = !!active;
    await user.save({ session });
    await logAdminAction({
      action: active ? 'user.activate' : 'user.deactivate',
      actorUserId: req.user.id,
      targetType: 'user',
      targetId: user._id,
      before,
      after: sanitizeUserSnapshot(user.toObject()),
      session
    });
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

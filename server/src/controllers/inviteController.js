const crypto = require('crypto');
const InviteToken = require('../models/InviteToken');
const Unit = require('../models/Unit');
const Company = require('../models/Company');
const Team = require('../models/Team');
const Squad = require('../models/Squad');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { OPERATIONAL_ROLES } = require('../utils/roles');
const { OPERATIONAL_ROLE_RANK, assertCompanyAccess } = require('../middleware/authorize');
const { resolveHierarchyPath } = require('../services/hierarchyService');
const { logAdminAction } = require('../services/adminAuditService');
const { withTransaction } = require('../utils/withTransaction');

const createInvite = asyncHandler(async (req, res) => {
  const {
    assignedOperationalRole,
    assignedRole = 'user',
    unitId,
    companyId,
    teamId,
    squadId,
    expiresInDays = 7
  } = req.body;

  if (!assignedOperationalRole || !OPERATIONAL_ROLES.includes(assignedOperationalRole)) {
    throw new AppError('VALIDATION_ERROR', 'assignedOperationalRole must be a valid operational role', 400);
  }

  const actorRank = OPERATIONAL_ROLE_RANK[req.user.operationalRole] ?? 0;
  const targetRank = OPERATIONAL_ROLE_RANK[assignedOperationalRole] ?? 0;
  if (targetRank >= actorRank) {
    throw new AppError('FORBIDDEN', 'Cannot assign an operational role at or above your own rank', 403);
  }

  if (assignedRole === 'admin' && req.user.operationalRole !== 'HQ') {
    throw new AppError('FORBIDDEN', 'Only HQ can generate admin invites', 403);
  }

  const days = Math.min(Math.max(parseInt(expiresInDays, 10) || 7, 1), 30);

  const hierarchy = await resolveHierarchyPath({ unitId, companyId, teamId, squadId });
  assertCompanyAccess(req.user, hierarchy.companyId);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const invite = await withTransaction(async (session) => {
    const [doc] = await InviteToken.create(
      [{
        token,
        createdBy: req.user.id,
        expiresAt,
        assignedRole,
        assignedOperationalRole,
        unitId: hierarchy.unitId,
        companyId: hierarchy.companyId,
        teamId: hierarchy.teamId,
        squadId: hierarchy.squadId,
        inviterName: req.userDoc?.name || req.user.name || ''
      }],
      { session }
    );
    await logAdminAction({
      action: 'invite.create',
      actorUserId: req.user.id,
      targetType: 'invite',
      targetId: doc._id,
      before: null,
      after: { token: doc.token, assignedOperationalRole, assignedRole, expiresAt },
      session
    });
    return doc;
  });

  res.status(201).json({
    success: true,
    data: {
      invite: {
        _id: invite._id,
        token: invite.token,
        expiresAt: invite.expiresAt,
        assignedRole: invite.assignedRole,
        assignedOperationalRole: invite.assignedOperationalRole,
        inviterName: invite.inviterName
      }
    }
  });
});

const validateInviteToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const invite = await InviteToken.findOne({
    token,
    active: true,
    usedAt: null,
    expiresAt: { $gt: new Date() }
  }).populate('createdBy', 'name operationalRole');

  if (!invite) {
    throw new AppError('INVITE_INVALID', 'Invite link is invalid or has expired.', 410);
  }

  // Fetch hierarchy names in parallel
  const [unit, company, team, squad] = await Promise.all([
    Unit.findById(invite.unitId).select('name').lean(),
    Company.findById(invite.companyId).select('name').lean(),
    Team.findById(invite.teamId).select('name').lean(),
    Squad.findById(invite.squadId).select('name').lean()
  ]);

  res.json({
    success: true,
    data: {
      inviterName: invite.createdBy?.name || invite.inviterName || 'Your commander',
      assignedOperationalRole: invite.assignedOperationalRole,
      assignedRole: invite.assignedRole,
      unitId: invite.unitId,
      companyId: invite.companyId,
      teamId: invite.teamId,
      squadId: invite.squadId,
      unitName: unit?.name || '',
      companyName: company?.name || '',
      teamName: team?.name || '',
      squadName: squad?.name || '',
      expiresAt: invite.expiresAt
    }
  });
});

const listInvites = asyncHandler(async (req, res) => {
  const filter = { createdBy: req.user.id };

  // COMPANY_COMMANDER can only see invites they created (already filtered by createdBy)
  // HQ/UNIT_COMMANDER see all invites within their unit scope
  if (['HQ', 'UNIT_COMMANDER'].includes(req.user.operationalRole)) {
    delete filter.createdBy;
    filter.unitId = req.user.unitId;
  }

  const { status } = req.query;
  const now = new Date();

  if (status === 'used') {
    filter.usedAt = { $ne: null };
  } else if (status === 'expired') {
    filter.usedAt = null;
    filter.expiresAt = { $lte: now };
  } else if (status === 'active') {
    filter.active = true;
    filter.usedAt = null;
    filter.expiresAt = { $gt: now };
  }

  const invites = await InviteToken.find(filter)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name')
    .populate('usedBy', 'name email')
    .lean();

  res.json({
    success: true,
    data: { invites }
  });
});

const revokeInvite = asyncHandler(async (req, res) => {
  const invite = await InviteToken.findById(req.params.id);
  if (!invite) {
    throw new AppError('NOT_FOUND', 'Invite not found', 404);
  }

  assertCompanyAccess(req.user, invite.companyId);

  // COMPANY_COMMANDER can only revoke their own invites
  if (req.user.operationalRole === 'COMPANY_COMMANDER' &&
      String(invite.createdBy) !== String(req.user.id)) {
    throw new AppError('FORBIDDEN', 'You can only revoke invites you created', 403);
  }

  const before = { active: invite.active };

  await withTransaction(async (session) => {
    invite.active = false;
    await invite.save({ session });
    await logAdminAction({
      action: 'invite.revoke',
      actorUserId: req.user.id,
      targetType: 'invite',
      targetId: invite._id,
      before,
      after: { active: false },
      session
    });
  });

  res.json({ success: true, data: { invite } });
});

module.exports = {
  createInvite,
  validateInviteToken,
  listInvites,
  revokeInvite
};

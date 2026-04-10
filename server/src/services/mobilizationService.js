'use strict';

const MobilizationEvent = require('../models/MobilizationEvent');
const { VALID_TRANSITIONS } = require('../models/MobilizationEvent');
const { AppError } = require('../utils/errors');
const { OPERATIONAL_ROLE_RANK } = require('../middleware/authorize');

// Minimum operational role rank required to trigger a mobilization
const MIN_MOBILIZATION_RANK = OPERATIONAL_ROLE_RANK.TEAM_COMMANDER; // rank 2

/**
 * Assert the requesting user has authority to trigger a mobilization against
 * the given targetScope, and that the scope is consistent with their rank.
 *
 * Rules:
 *   HQ / UNIT_COMMANDER (rank ≥ 4) — can target any scope within any unit
 *   COMPANY_COMMANDER   (rank 3)   — can only target their own companyId
 *   TEAM_COMMANDER      (rank 2)   — can only target their own teamId
 */
const assertMobilizationAuthority = (actor, targetScope) => {
  const rank = OPERATIONAL_ROLE_RANK[actor.operationalRole] ?? 0;

  if (rank < MIN_MOBILIZATION_RANK) {
    throw new AppError(
      'FORBIDDEN',
      'Only TEAM_COMMANDER rank or above may trigger a mobilization',
      403
    );
  }

  // TEAM_COMMANDER: can only mobilize their own team
  if (actor.operationalRole === 'TEAM_COMMANDER') {
    if (!targetScope.teamId) {
      throw new AppError(
        'FORBIDDEN',
        'TEAM_COMMANDER must target their own team — provide targetScope.teamId',
        403
      );
    }
    if (String(targetScope.teamId) !== String(actor.teamId)) {
      throw new AppError('FORBIDDEN', 'TEAM_COMMANDER can only mobilize their own team', 403);
    }
    // Ensure companyId and unitId match
    if (targetScope.companyId && String(targetScope.companyId) !== String(actor.companyId)) {
      throw new AppError('FORBIDDEN', 'Scope companyId does not match your company', 403);
    }
    if (String(targetScope.unitId) !== String(actor.unitId)) {
      throw new AppError('FORBIDDEN', 'Scope unitId does not match your unit', 403);
    }
    return;
  }

  // COMPANY_COMMANDER: can mobilize any team within their company, or the whole company
  if (actor.operationalRole === 'COMPANY_COMMANDER') {
    if (String(targetScope.unitId) !== String(actor.unitId)) {
      throw new AppError('FORBIDDEN', 'Scope unitId does not match your unit', 403);
    }
    if (!targetScope.companyId) {
      throw new AppError(
        'FORBIDDEN',
        'COMPANY_COMMANDER must specify targetScope.companyId',
        403
      );
    }
    if (String(targetScope.companyId) !== String(actor.companyId)) {
      throw new AppError('FORBIDDEN', 'COMPANY_COMMANDER can only mobilize within their own company', 403);
    }
    return;
  }

  // UNIT_COMMANDER / HQ — validate unitId only
  if (
    actor.operationalRole === 'UNIT_COMMANDER' &&
    String(targetScope.unitId) !== String(actor.unitId)
  ) {
    throw new AppError('FORBIDDEN', 'UNIT_COMMANDER can only mobilize within their own unit', 403);
  }
  // HQ has no scope restriction
};

/**
 * Validate that teamId implies companyId is also set.
 */
const assertScopeConsistency = (targetScope) => {
  if (targetScope.teamId && !targetScope.companyId) {
    throw new AppError(
      'VALIDATION_ERROR',
      'targetScope.companyId is required when targetScope.teamId is provided',
      400
    );
  }
};

/**
 * Returns true if the user belongs to the mobilization's target scope.
 * Used by socket broadcast and push targeting.
 *
 * @param {object} userInfo  — user fields: unitId, companyId, teamId (as ObjectIds or strings)
 * @param {object} targetScope — from MobilizationEvent.targetScope
 */
const isUserInMobilizationScope = (userInfo, targetScope) => {
  if (!userInfo || !targetScope) return false;
  if (String(userInfo.unitId) !== String(targetScope.unitId)) return false;
  if (targetScope.companyId && String(userInfo.companyId) !== String(targetScope.companyId)) return false;
  if (targetScope.teamId    && String(userInfo.teamId)    !== String(targetScope.teamId))    return false;
  return true;
};

/**
 * Create a new MobilizationEvent. Rejects if there is already an active
 * mobilization for the same unit (prevents overlapping unit-level mobilizations).
 */
const createMobilization = async ({ actor, targetScope, incidentDescription, rallyPoint, rallyPointName }) => {
  assertScopeConsistency(targetScope);
  assertMobilizationAuthority(actor, targetScope);

  // One active mobilization per unit — prevents command confusion
  const existing = await MobilizationEvent.findOne({
    'targetScope.unitId': targetScope.unitId,
    status: { $nin: ['STOOD_DOWN'] }
  }).lean();

  if (existing) {
    throw new AppError(
      'MOBILIZATION_CONFLICT',
      'An active mobilization already exists for this unit. Stand it down before creating a new one.',
      409
    );
  }

  const doc = new MobilizationEvent({
    triggeredBy: actor.id,
    targetScope: {
      unitId:    targetScope.unitId,
      companyId: targetScope.companyId || null,
      teamId:    targetScope.teamId    || null
    },
    incidentDescription: incidentDescription || null,
    rallyPoint: rallyPoint || undefined,
    rallyPointName: rallyPointName || null
  });

  await doc.save();
  return doc;
};

/**
 * Get the active mobilization relevant to the requesting user's scope.
 * Admins see all active mobilizations across units.
 * Others see the one active in their unit (if any).
 */
const getActiveMobilization = async (actor) => {
  const rank = OPERATIONAL_ROLE_RANK[actor.operationalRole] ?? 0;
  const isAdmin = actor.role === 'admin';

  let query;
  if (isAdmin || rank >= OPERATIONAL_ROLE_RANK.UNIT_COMMANDER) {
    // HQ/UC/admin: see all non-stood-down mobilizations in their unit (or all for admin)
    query = isAdmin
      ? { status: { $nin: ['STOOD_DOWN'] } }
      : { 'targetScope.unitId': actor.unitId, status: { $nin: ['STOOD_DOWN'] } };
  } else {
    // Everyone else: only see mobilizations that include them in scope
    const orClauses = [{ 'targetScope.unitId': actor.unitId, 'targetScope.companyId': null, 'targetScope.teamId': null }];
    if (actor.companyId) orClauses.push({ 'targetScope.unitId': actor.unitId, 'targetScope.companyId': actor.companyId, 'targetScope.teamId': null });
    if (actor.teamId)    orClauses.push({ 'targetScope.unitId': actor.unitId, 'targetScope.companyId': actor.companyId, 'targetScope.teamId': actor.teamId });
    query = { $or: orClauses, status: { $nin: ['STOOD_DOWN'] } };
  }

  return MobilizationEvent.find(query)
    .populate('triggeredBy', 'name operationalRole')
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Advance the mobilization to the next phase in the state machine.
 */
const advanceMobilizationStatus = async ({ mobilizationId, nextStatus, actor }) => {
  const mob = await MobilizationEvent.findById(mobilizationId);
  if (!mob) throw new AppError('NOT_FOUND', 'Mobilization not found', 404);
  if (mob.status === 'STOOD_DOWN') throw new AppError('MOBILIZATION_ENDED', 'Mobilization has already been stood down', 409);

  const allowed = VALID_TRANSITIONS[mob.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      'INVALID_TRANSITION',
      `Cannot transition from ${mob.status} to ${nextStatus}. Valid next: ${allowed.join(', ') || 'none'}`,
      422
    );
  }

  assertMobilizationAuthority(actor, mob.targetScope);

  mob.status = nextStatus;
  await mob.save();
  return mob;
};

/**
 * Stand down a mobilization. Only the triggering commander or HQ/UC can do this.
 */
const standDownMobilization = async ({ mobilizationId, actor }) => {
  const mob = await MobilizationEvent.findById(mobilizationId);
  if (!mob) throw new AppError('NOT_FOUND', 'Mobilization not found', 404);
  if (mob.status === 'STOOD_DOWN') throw new AppError('MOBILIZATION_ENDED', 'Already stood down', 409);

  const isTriggerer = String(mob.triggeredBy) === String(actor.id);
  const rank = OPERATIONAL_ROLE_RANK[actor.operationalRole] ?? 0;
  const isAdmin = actor.role === 'admin';
  const isHighCommand = rank >= OPERATIONAL_ROLE_RANK.UNIT_COMMANDER;

  if (!isTriggerer && !isAdmin && !isHighCommand) {
    throw new AppError('FORBIDDEN', 'Only the triggering commander, HQ, or UNIT_COMMANDER may stand down a mobilization', 403);
  }

  mob.status      = 'STOOD_DOWN';
  mob.stoodDownAt = new Date();
  mob.stoodDownBy = actor.id;
  await mob.save();
  return mob;
};

module.exports = {
  createMobilization,
  getActiveMobilization,
  advanceMobilizationStatus,
  standDownMobilization,
  isUserInMobilizationScope
};

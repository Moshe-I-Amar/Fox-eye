const Team = require('../models/Team');
const Squad = require('../models/Squad');
const { AppError } = require('../utils/errors');

// ---------------------------------------------------------------------------
// Role hierarchy — higher number = more authority
// ---------------------------------------------------------------------------

const OPERATIONAL_ROLE_RANK = {
  SQUAD_COMMANDER: 1,
  TEAM_COMMANDER: 2,
  COMPANY_COMMANDER: 3,
  UNIT_COMMANDER: 4,
  HQ: 5
};

/**
 * Asserts the actor (req.user) has authority to edit the target user's roles.
 * Throws AppError('FORBIDDEN') on any violation.
 *
 * Rules:
 *  - Cannot edit self (privilege escalation)
 *  - Cannot edit HQ or UNIT_COMMANDER targets (peers/superiors)
 *  - Cannot edit admin accounts unless actor is HQ
 *  - UNIT_COMMANDER scope is limited to their own unitId
 *  - Cannot promote target to actor's own rank or above
 *  - Only HQ can grant role=admin
 *
 * @param {object} actor      - req.user (lightweight JWT payload)
 * @param {object} target     - full Mongoose user document
 * @param {string} [nextOperationalRole] - requested new operationalRole (may be undefined)
 * @param {string} [nextRole]            - requested new system role (may be undefined)
 */
const assertRoleEditAuthority = (actor, target, nextOperationalRole, nextRole) => {
  if (String(actor.id) === String(target._id)) {
    throw new AppError('FORBIDDEN', 'Cannot edit your own roles', 403);
  }

  if (['HQ', 'UNIT_COMMANDER'].includes(target.operationalRole)) {
    throw new AppError('FORBIDDEN', 'Cannot edit the roles of HQ or UNIT_COMMANDER users', 403);
  }

  if (target.role === 'admin' && actor.operationalRole !== 'HQ') {
    throw new AppError('FORBIDDEN', 'Only HQ can edit admin accounts', 403);
  }

  if (actor.operationalRole === 'UNIT_COMMANDER' &&
      String(target.unitId) !== String(actor.unitId)) {
    throw new AppError('FORBIDDEN', 'UNIT_COMMANDER can only edit users within their own unit', 403);
  }

  const actorRank = OPERATIONAL_ROLE_RANK[actor.operationalRole] ?? 0;

  if (nextOperationalRole !== undefined) {
    const targetRank = OPERATIONAL_ROLE_RANK[nextOperationalRole] ?? 0;
    if (targetRank >= actorRank) {
      throw new AppError('FORBIDDEN', 'Cannot assign an operational role at or above your own rank', 403);
    }
  }

  if (nextRole === 'admin' && actor.operationalRole !== 'HQ') {
    throw new AppError('FORBIDDEN', 'Only HQ can grant admin access', 403);
  }
};

// ---------------------------------------------------------------------------
// Predicates — pure functions, no side effects
// ---------------------------------------------------------------------------

const isAdmin = (user) => user?.role === 'admin';

const isCompanyCommander = (user) => user?.operationalRole === 'COMPANY_COMMANDER';

/**
 * Returns true if the user has access to the given companyId.
 * Admins always have access. Company commanders only have access to their own company.
 */
const hasCompanyAccess = (user, companyId) => {
  if (isAdmin(user)) return true;
  if (!isCompanyCommander(user)) return false;
  if (!companyId || !user?.companyId) return false;
  return String(companyId) === String(user.companyId);
};

// ---------------------------------------------------------------------------
// Assert helpers — throw AppError when access is denied
// Used inside controllers after a DB document has been fetched.
// ---------------------------------------------------------------------------

/**
 * Throws FORBIDDEN if a company commander tries to access a company they don't own.
 * Admins and non-CC roles pass through silently.
 */
const assertCompanyAccess = (user, companyId) => {
  if (!isCompanyCommander(user)) return;
  if (!companyId || !user?.companyId || String(companyId) !== String(user.companyId)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }
};

/**
 * For company commanders: fetches the team and asserts the user owns its parent company.
 * Returns the team document (useful for callers that need it).
 * Returns null for non-CC roles (no access check needed).
 */
const assertCompanyAccessFromTeam = async (user, teamId) => {
  if (!isCompanyCommander(user)) return null;
  if (!teamId) {
    throw new AppError('VALIDATION_ERROR', 'Team ID is required', 400);
  }
  const team = await Team.findById(teamId).lean();
  if (!team) {
    throw new AppError('NOT_FOUND', 'Team not found', 404);
  }
  assertCompanyAccess(user, team.parentId);
  return team;
};

/**
 * For company commanders: fetches the squad and its parent team, then asserts company access.
 * Returns { squad, team } (useful for callers that need both documents).
 * Returns null for non-CC roles.
 */
const assertCompanyAccessFromSquad = async (user, squadId) => {
  if (!isCompanyCommander(user)) return null;
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
  assertCompanyAccess(user, team.parentId);
  return { squad, team };
};

// ---------------------------------------------------------------------------
// Route-level middleware
// ---------------------------------------------------------------------------

/**
 * Requires the authenticated user to be an admin OR a company commander.
 * Use as route middleware after `auth`.
 */
const requireAdminOrCompanyCommander = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('AUTH_REQUIRED', 'Access denied. Authentication required.', 401));
  }
  if (!isAdmin(req.user) && !isCompanyCommander(req.user)) {
    return next(new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403));
  }
  next();
};

module.exports = {
  isAdmin,
  isCompanyCommander,
  hasCompanyAccess,
  assertCompanyAccess,
  assertCompanyAccessFromTeam,
  assertCompanyAccessFromSquad,
  requireAdminOrCompanyCommander,
  OPERATIONAL_ROLE_RANK,
  assertRoleEditAuthority
};

const Team = require('../models/Team');
const Squad = require('../models/Squad');
const { AppError } = require('../utils/errors');

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
  requireAdminOrCompanyCommander
};

const asyncHandler = require('../utils/asyncHandler');
const { buildScopeQuery } = require('../utils/filterByScope');
const violationService = require('../services/violationService');

const EMPTY_PAGINATION = (page, limit) => ({ page, limit, total: 0, pages: 0 });

const listViolations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;

  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    const pagination = EMPTY_PAGINATION(page, limit);
    return res.json({ success: true, data: { violations: [], pagination }, pagination });
  }

  const { companyId, severity, type, start, end } = req.query;
  const result = await violationService.listViolations({
    scopeQuery, companyId, severity, type, start, end, page, limit
  });

  res.json({ success: true, data: result, pagination: result.pagination });
});

const getViolationById = asyncHandler(async (req, res) => {
  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    const { AppError } = require('../utils/errors');
    throw new AppError('NOT_FOUND', 'Violation not found', 404);
  }

  const violation = await violationService.getViolationById({
    id: req.params.id,
    scopeQuery
  });

  res.json({ success: true, data: { violation } });
});

module.exports = { listViolations, getViolationById };

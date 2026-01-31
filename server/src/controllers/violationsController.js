const ViolationEvent = require('../models/ViolationEvent');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { buildScopeQuery } = require('../utils/filterByScope');

const SEVERITY_TYPES = {
  low: ['APPROACHING_BOUNDARY'],
  medium: ['BREACH'],
  high: ['SUSTAINED_BREACH']
};

const parseDate = (value, label) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('VALIDATION_ERROR', `Invalid ${label} date`, 400);
  }
  return date;
};

const listViolations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const skip = (page - 1) * limit;

  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    const emptyPagination = { page, limit, total: 0, pages: 0 };
    return res.json({
      success: true,
      data: { violations: [], pagination: emptyPagination },
      pagination: emptyPagination
    });
  }

  const filters = [];
  const { companyId, severity, type, start, end } = req.query;

  if (companyId) {
    filters.push({ companyId });
  }

  if (type) {
    filters.push({ type });
  }

  if (severity) {
    const severityKeys = severity.split(',').map((value) => value.trim().toLowerCase());
    const types = severityKeys.flatMap((key) => SEVERITY_TYPES[key] || []);
    if (!types.length) {
      throw new AppError('VALIDATION_ERROR', 'Invalid severity filter', 400);
    }
    filters.push({ type: { $in: types } });
  }

  const startDate = parseDate(start, 'start');
  const endDate = parseDate(end, 'end');
  if (startDate || endDate) {
    const range = {};
    if (startDate) range.$gte = startDate;
    if (endDate) range.$lte = endDate;
    filters.push({ occurredAt: range });
  }

  const query = filters.length
    ? { $and: [scopeQuery, ...filters] }
    : scopeQuery;

  const violations = await ViolationEvent.find(query)
    .sort({ occurredAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await ViolationEvent.countDocuments(query);
  const pagination = {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit)
  };

  res.json({
    success: true,
    data: { violations, pagination },
    pagination
  });
});

const getViolationById = asyncHandler(async (req, res) => {
  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    throw new AppError('NOT_FOUND', 'Violation not found', 404);
  }

  const violation = await ViolationEvent.findOne({
    $and: [{ _id: req.params.id }, scopeQuery]
  }).lean();

  if (!violation) {
    throw new AppError('NOT_FOUND', 'Violation not found', 404);
  }

  res.json({
    success: true,
    data: { violation }
  });
});

module.exports = {
  listViolations,
  getViolationById
};

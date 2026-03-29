const ViolationEvent = require('../models/ViolationEvent');
const { AppError } = require('../utils/errors');

const SEVERITY_TYPES = {
  low: ['APPROACHING_BOUNDARY'],
  medium: ['BREACH'],
  high: ['SUSTAINED_BREACH']
};

/**
 * Parses a date string and throws a validation error if invalid.
 */
const parseDate = (value, label) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('VALIDATION_ERROR', `Invalid ${label} date`, 400);
  }
  return date;
};

/**
 * Builds a MongoDB filter from query parameters.
 * Returns null if the scopeQuery is empty (caller should return empty result).
 */
const buildViolationQuery = ({ scopeQuery, companyId, severity, type, start, end }) => {
  const filters = [];

  if (companyId) {
    filters.push({ companyId });
  }

  if (type) {
    filters.push({ type });
  }

  if (severity) {
    const severityKeys = severity.split(',').map((v) => v.trim().toLowerCase());
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

  return filters.length
    ? { $and: [scopeQuery, ...filters] }
    : scopeQuery;
};

/**
 * Returns a paginated list of violations matching the given scope and filters.
 */
const listViolations = async ({ scopeQuery, companyId, severity, type, start, end, page, limit }) => {
  const skip = (page - 1) * limit;
  const query = buildViolationQuery({ scopeQuery, companyId, severity, type, start, end });

  const [violations, total] = await Promise.all([
    ViolationEvent.find(query).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
    ViolationEvent.countDocuments(query)
  ]);

  return {
    violations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Returns a single violation by ID, scoped to the requesting user.
 */
const getViolationById = async ({ id, scopeQuery }) => {
  const violation = await ViolationEvent.findOne({
    $and: [{ _id: id }, scopeQuery]
  }).lean();

  if (!violation) {
    throw new AppError('NOT_FOUND', 'Violation not found', 404);
  }

  return violation;
};

module.exports = { buildViolationQuery, listViolations, getViolationById };

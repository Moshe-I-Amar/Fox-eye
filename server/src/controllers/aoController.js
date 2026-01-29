const AO = require('../models/AO');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const isAdmin = (user) => user?.role === 'admin';
const isCompanyCommander = (user) => user?.operationalRole === 'COMPANY_COMMANDER';

const hasCompanyAccess = (user, companyId) => {
  if (isAdmin(user)) {
    return true;
  }

  if (!isCompanyCommander(user)) {
    return false;
  }

  if (!companyId || !user?.companyId) {
    return false;
  }

  return String(companyId) === String(user.companyId);
};

const listAOs = asyncHandler(async (req, res) => {
  const isAdminUser = isAdmin(req.user);
  const requestedCompanyId = req.query.companyId;
  const companyId = isAdminUser ? requestedCompanyId : req.user?.companyId;

  if (!isAdminUser && requestedCompanyId && String(requestedCompanyId) !== String(req.user?.companyId)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  const query = {};
  if (companyId) {
    query.companyId = companyId;
  }
  if (req.query.active !== undefined) {
    query.active = String(req.query.active) === 'true';
  }

  const aos = await AO.find(query).sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: { aos }
  });
});

const createAO = asyncHandler(async (req, res) => {
  if (!isAdmin(req.user) && !isCompanyCommander(req.user)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  const { name, polygon, style, companyId: requestedCompanyId } = req.body;
  const companyId = isAdmin(req.user)
    ? requestedCompanyId
    : (requestedCompanyId || req.user.companyId);

  if (!companyId) {
    throw new AppError('VALIDATION_ERROR', 'Company ID is required.', 400);
  }

  if (!hasCompanyAccess(req.user, companyId)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  const company = await Company.findById(companyId).lean();
  if (!company) {
    throw new AppError('NOT_FOUND', 'Company not found', 404);
  }

  const ao = await AO.create({
    name,
    polygon,
    companyId,
    style: style || undefined
  });

  res.status(201).json({
    success: true,
    data: { ao }
  });
});

const updateAO = asyncHandler(async (req, res) => {
  if (!isAdmin(req.user) && !isCompanyCommander(req.user)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  const ao = await AO.findById(req.params.id);
  if (!ao) {
    throw new AppError('NOT_FOUND', 'AO not found', 404);
  }

  if (!hasCompanyAccess(req.user, ao.companyId)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  if (!isAdmin(req.user) && req.body.companyId && String(req.body.companyId) !== String(req.user.companyId)) {
    throw new AppError('FORBIDDEN', 'Access denied. Cannot change company assignment.', 403);
  }

  const updates = {};
  const { name, polygon, style, companyId } = req.body;

  if (name !== undefined) {
    updates.name = name;
  }
  if (polygon !== undefined) {
    updates.polygon = polygon;
  }
  if (style !== undefined) {
    if (Object.prototype.hasOwnProperty.call(style, 'color')) {
      updates['style.color'] = style.color;
    }
    if (Object.prototype.hasOwnProperty.call(style, 'pattern')) {
      updates['style.pattern'] = style.pattern;
    }
    if (Object.prototype.hasOwnProperty.call(style, 'icon')) {
      updates['style.icon'] = style.icon;
    }
  }
  if (companyId !== undefined) {
    updates.companyId = companyId;
  }

  if (!Object.keys(updates).length) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  if (updates.companyId && isAdmin(req.user)) {
    const company = await Company.findById(updates.companyId).lean();
    if (!company) {
      throw new AppError('NOT_FOUND', 'Company not found', 404);
    }
  }

  const updatedAO = await AO.findByIdAndUpdate(
    ao._id,
    updates,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: { ao: updatedAO }
  });
});

const setAOActive = asyncHandler(async (req, res) => {
  if (!isAdmin(req.user) && !isCompanyCommander(req.user)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  const ao = await AO.findById(req.params.id);
  if (!ao) {
    throw new AppError('NOT_FOUND', 'AO not found', 404);
  }

  if (!hasCompanyAccess(req.user, ao.companyId)) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  ao.active = req.body.active;
  await ao.save();

  res.json({
    success: true,
    data: { ao }
  });
});

module.exports = {
  listAOs,
  createAO,
  updateAO,
  setAOActive
};

const AO = require('../models/AO');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { getSocketService } = require('../realtime/socket');

const isAdmin = (user) => user?.role === 'admin';
const isCompanyCommander = (user) => user?.operationalRole === 'COMPANY_COMMANDER';

const resolveCompanyScope = (req) => {
  if (req?.scope?.companies?.length) {
    return req.scope.companies;
  }
  if (req?.user?.companyId) {
    return [req.user.companyId];
  }
  return [];
};

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
  const requestedCompanyId = req.query.companyId;
  const allowedCompanyIds = resolveCompanyScope(req);

  if (allowedCompanyIds.length === 0) {
    return res.json({
      success: true,
      data: { aos: [] }
    });
  }

  if (requestedCompanyId && !allowedCompanyIds.some((id) => String(id) === String(requestedCompanyId))) {
    throw new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403);
  }

  const query = {};
  if (requestedCompanyId) {
    query.companyId = requestedCompanyId;
  } else if (allowedCompanyIds.length) {
    query.companyId = { $in: allowedCompanyIds };
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

  const { name, polygon, companyId: requestedCompanyId } = req.body;
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
    style: {
      color: company.color,
      pattern: company.pattern,
      icon: company.icon
    }
  });

  try {
    const socketService = getSocketService();
    socketService.emitAoToCompanyScope(ao.companyId, 'ao:created', { ao });
  } catch (error) {
    console.warn('AO socket emit failed:', error.message);
  }

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
  const previousCompanyId = ao.companyId ? ao.companyId.toString() : null;
  const { name, polygon, style, companyId } = req.body;

  if (name !== undefined) {
    updates.name = name;
  }
  if (polygon !== undefined) {
    updates.polygon = polygon;
  }
  const wantsStyleUpdate = style !== undefined;
  if (companyId !== undefined) {
    updates.companyId = companyId;
  }

  if (!Object.keys(updates).length) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  if (updates.companyId && !isAdmin(req.user)) {
    throw new AppError('FORBIDDEN', 'Access denied. Cannot change company assignment.', 403);
  }

  if (wantsStyleUpdate || updates.companyId) {
    const targetCompanyId = updates.companyId || ao.companyId;
    const company = await Company.findById(targetCompanyId).lean();
    if (!company) {
      throw new AppError('NOT_FOUND', 'Company not found', 404);
    }
    updates['style.color'] = company.color;
    updates['style.pattern'] = company.pattern;
    updates['style.icon'] = company.icon;
  }

  const updatedAO = await AO.findByIdAndUpdate(
    ao._id,
    updates,
    { new: true, runValidators: true }
  );

  try {
    const socketService = getSocketService();
    const nextCompanyId = updatedAO?.companyId ? updatedAO.companyId.toString() : null;
    if (previousCompanyId && nextCompanyId && previousCompanyId !== nextCompanyId) {
      socketService.emitAoToCompanyScope(previousCompanyId, 'ao:deleted', { aoId: updatedAO._id.toString() });
      socketService.emitAoToCompanyScope(nextCompanyId, 'ao:updated', { ao: updatedAO });
    } else {
      socketService.emitAoToCompanyScope(updatedAO.companyId, 'ao:updated', { ao: updatedAO });
    }
  } catch (error) {
    console.warn('AO socket emit failed:', error.message);
  }

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

  try {
    const socketService = getSocketService();
    socketService.emitAoToCompanyScope(ao.companyId, 'ao:updated', { ao });
  } catch (error) {
    console.warn('AO socket emit failed:', error.message);
  }

  res.json({
    success: true,
    data: { ao }
  });
});

const deleteAO = asyncHandler(async (req, res) => {
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

  await ao.deleteOne();

  try {
    const socketService = getSocketService();
    socketService.emitAoToCompanyScope(ao.companyId, 'ao:deleted', { aoId: ao._id.toString() });
  } catch (error) {
    console.warn('AO socket emit failed:', error.message);
  }

  res.json({
    success: true,
    data: { aoId: ao._id.toString() }
  });
});

module.exports = {
  listAOs,
  createAO,
  updateAO,
  setAOActive,
  deleteAO
};

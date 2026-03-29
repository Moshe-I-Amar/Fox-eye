const AO = require('../models/AO');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { isAdmin, isCompanyCommander, hasCompanyAccess } = require('../middleware/authorize');
const aoService = require('../services/aoService');

const resolveCompanyScope = (req) => {
  if (req?.scope?.companies?.length) {
    return req.scope.companies;
  }
  if (req?.user?.companyId) {
    return [req.user.companyId];
  }
  return [];
};

const listAOs = asyncHandler(async (req, res) => {
  const requestedCompanyId = req.query.companyId;
  const allowedCompanyIds = resolveCompanyScope(req);

  if (allowedCompanyIds.length === 0) {
    return res.json({ success: true, data: { aos: [] } });
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

  res.json({ success: true, data: { aos } });
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

  const ao = await aoService.createAO({ name, polygon, companyId });

  res.status(201).json({ success: true, data: { ao } });
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

  const { name, polygon, style, companyId } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name;
  if (polygon !== undefined) updates.polygon = polygon;
  if (companyId !== undefined) {
    if (!isAdmin(req.user)) {
      throw new AppError('FORBIDDEN', 'Access denied. Cannot change company assignment.', 403);
    }
    updates.companyId = companyId;
  }

  if (!Object.keys(updates).length && style === undefined) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields provided for update', 400);
  }

  const updatedAO = await aoService.updateAO({
    aoId: ao._id,
    updates,
    wantsStyleUpdate: style !== undefined
  });

  res.json({ success: true, data: { ao: updatedAO } });
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

  const updatedAo = await aoService.setAOActive({ aoId: ao._id, active: req.body.active });

  res.json({ success: true, data: { ao: updatedAo } });
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

  const aoId = await aoService.deleteAO({ aoId: ao._id });

  res.json({ success: true, data: { aoId } });
});

module.exports = { listAOs, createAO, updateAO, setAOActive, deleteAO };

const AO = require('../models/AO');
const Company = require('../models/Company');
const { AppError } = require('../utils/errors');
const { getSocketService } = require('../realtime/socket');

// Safely emit an AO event — never throws, warns on failure.
const emitAoEvent = (companyId, event, payload) => {
  try {
    const socketService = getSocketService();
    socketService.emitAoToCompanyScope(companyId, event, payload);
  } catch (err) {
    console.warn(`AO socket emit failed [${event}]:`, err.message);
  }
};

/**
 * Creates a new AO and notifies connected clients.
 */
const createAO = async ({ name, polygon, companyId }) => {
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

  emitAoEvent(ao.companyId, 'ao:created', { ao });

  return ao;
};

/**
 * Updates an AO and notifies connected clients.
 * Handles company reassignment by emitting a delete to the old company scope
 * and a create to the new one.
 */
const updateAO = async ({ aoId, updates, requestedCompanyId, wantsStyleUpdate }) => {
  const ao = await AO.findById(aoId);
  if (!ao) {
    throw new AppError('NOT_FOUND', 'AO not found', 404);
  }

  const previousCompanyId = ao.companyId ? ao.companyId.toString() : null;

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

  const updatedAO = await AO.findByIdAndUpdate(aoId, updates, {
    new: true,
    runValidators: true
  });

  const nextCompanyId = updatedAO.companyId ? updatedAO.companyId.toString() : null;

  if (previousCompanyId && nextCompanyId && previousCompanyId !== nextCompanyId) {
    emitAoEvent(previousCompanyId, 'ao:deleted', { aoId: updatedAO._id.toString() });
    emitAoEvent(nextCompanyId, 'ao:updated', { ao: updatedAO });
  } else {
    emitAoEvent(updatedAO.companyId, 'ao:updated', { ao: updatedAO });
  }

  return updatedAO;
};

/**
 * Toggles an AO's active state and notifies connected clients.
 */
const setAOActive = async ({ aoId, active }) => {
  const ao = await AO.findById(aoId);
  if (!ao) {
    throw new AppError('NOT_FOUND', 'AO not found', 404);
  }

  ao.active = active;
  await ao.save();

  emitAoEvent(ao.companyId, 'ao:updated', { ao });

  return ao;
};

/**
 * Deletes an AO and notifies connected clients.
 */
const deleteAO = async ({ aoId }) => {
  const ao = await AO.findById(aoId);
  if (!ao) {
    throw new AppError('NOT_FOUND', 'AO not found', 404);
  }

  const companyId = ao.companyId;
  const deletedId = ao._id.toString();

  await ao.deleteOne();

  emitAoEvent(companyId, 'ao:deleted', { aoId: deletedId });

  return deletedId;
};

module.exports = { createAO, updateAO, setAOActive, deleteAO };

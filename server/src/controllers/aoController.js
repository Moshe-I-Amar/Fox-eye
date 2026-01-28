const AO = require('../models/AO');
const Company = require('../models/Company');

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

const listAOs = async (req, res) => {
  try {
    const isAdminUser = isAdmin(req.user);
    const requestedCompanyId = req.query.companyId;
    const companyId = isAdminUser ? requestedCompanyId : req.user?.companyId;

    if (!isAdminUser && requestedCompanyId && String(requestedCompanyId) !== String(req.user?.companyId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error loading AOs',
      details: error.message
    });
  }
};

const createAO = async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isCompanyCommander(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    const { name, polygon, style, companyId: requestedCompanyId } = req.body;
    const companyId = isAdmin(req.user)
      ? requestedCompanyId
      : (requestedCompanyId || req.user.companyId);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required.'
      });
    }

    if (!hasCompanyAccess(req.user, companyId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error creating AO',
      details: error.message
    });
  }
};

const updateAO = async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isCompanyCommander(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    const ao = await AO.findById(req.params.id);
    if (!ao) {
      return res.status(404).json({
        success: false,
        message: 'AO not found'
      });
    }

    if (!hasCompanyAccess(req.user, ao.companyId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    if (!isAdmin(req.user) && req.body.companyId && String(req.body.companyId) !== String(req.user.companyId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot change company assignment.'
      });
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
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update'
      });
    }

    if (updates.companyId && isAdmin(req.user)) {
      const company = await Company.findById(updates.companyId).lean();
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating AO',
      details: error.message
    });
  }
};

const setAOActive = async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isCompanyCommander(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    const ao = await AO.findById(req.params.id);
    if (!ao) {
      return res.status(404).json({
        success: false,
        message: 'AO not found'
      });
    }

    if (!hasCompanyAccess(req.user, ao.companyId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    ao.active = req.body.active;
    await ao.save();

    res.json({
      success: true,
      data: { ao }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating AO status',
      details: error.message
    });
  }
};

module.exports = {
  listAOs,
  createAO,
  updateAO,
  setAOActive
};

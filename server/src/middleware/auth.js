const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resolveUserScope } = require('../services/scopeResolver');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const auth = asyncHandler(async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new AppError('AUTH_REQUIRED', 'Access denied. No token provided.', 401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    throw new AppError('AUTH_INVALID_TOKEN', 'Invalid token. User not found.', 401);
  }

  req.userDoc = user;
  req.user = {
    id: user._id.toString(),
    role: user.role,
    operationalRole: user.operationalRole,
    unitId: user.unitId,
    companyId: user.companyId,
    teamId: user.teamId,
    squadId: user.squadId
  };
  req.scope = await resolveUserScope(user);
  next();
});

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('AUTH_REQUIRED', 'Access denied. Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'Access denied. Insufficient permissions.', 403));
    }

    next();
  };
};

module.exports = { auth, requireRole };

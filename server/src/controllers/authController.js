const User = require('../models/User');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { resolveHierarchyForRegistration } = require('../services/hierarchyService');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, unitId, companyId, teamId, squadId } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('USER_EXISTS', 'User already exists with this email', 400);
  }

  const resolvedHierarchy = await resolveHierarchyForRegistration({
    unitId,
    companyId,
    teamId,
    squadId
  });

  const user = new User({
    name,
    email,
    password,
    unitId: resolvedHierarchy.unitId,
    companyId: resolvedHierarchy.companyId,
    teamId: resolvedHierarchy.teamId,
    squadId: resolvedHierarchy.squadId
  });

  await user.save();

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { user, token }
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  if (user.active === false) {
    throw new AppError('AUTH_INACTIVE', 'User account is inactive.', 403);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    data: { user, token }
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: req.userDoc || req.user }
  });
});

module.exports = {
  register,
  login,
  getMe
};

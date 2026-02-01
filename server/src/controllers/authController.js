const User = require('../models/User');
const Unit = require('../models/Unit');
const Company = require('../models/Company');
const Team = require('../models/Team');
const Squad = require('../models/Squad');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const resolveHierarchy = async ({ unitId, companyId, teamId, squadId }) => {
  const unit = unitId
    ? await Unit.findOne({ _id: unitId, active: true }).lean()
    : await Unit.findOne({ active: true }).sort({ createdAt: 1 }).lean();

  if (!unit) {
    throw new AppError('HIERARCHY_UNIT_NOT_FOUND', 'Unit not found for registration', 400);
  }

  const company = companyId
    ? await Company.findOne({ _id: companyId, active: true }).lean()
    : await Company.findOne({ parentId: unit._id, active: true }).sort({ createdAt: 1 }).lean();

  if (!company) {
    throw new AppError('HIERARCHY_COMPANY_NOT_FOUND', 'Company not found for registration', 400);
  }

  if (String(company.parentId) !== String(unit._id)) {
    throw new AppError('HIERARCHY_COMPANY_MISMATCH', 'Company does not belong to the selected unit', 400);
  }

  const team = teamId
    ? await Team.findOne({ _id: teamId, active: true }).lean()
    : await Team.findOne({ parentId: company._id, active: true }).sort({ createdAt: 1 }).lean();

  if (!team) {
    throw new AppError('HIERARCHY_TEAM_NOT_FOUND', 'Team not found for registration', 400);
  }

  if (String(team.parentId) !== String(company._id)) {
    throw new AppError('HIERARCHY_TEAM_MISMATCH', 'Team does not belong to the selected company', 400);
  }

  const squad = squadId
    ? await Squad.findOne({ _id: squadId, active: true }).lean()
    : await Squad.findOne({ parentId: team._id, active: true }).sort({ createdAt: 1 }).lean();

  if (!squad) {
    throw new AppError('HIERARCHY_SQUAD_NOT_FOUND', 'Squad not found for registration', 400);
  }

  if (String(squad.parentId) !== String(team._id)) {
    throw new AppError('HIERARCHY_SQUAD_MISMATCH', 'Squad does not belong to the selected team', 400);
  }

  return {
    unitId: unit._id,
    companyId: company._id,
    teamId: team._id,
    squadId: squad._id
  };
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, unitId, companyId, teamId, squadId } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('USER_EXISTS', 'User already exists with this email', 400);
  }

  const resolvedHierarchy = await resolveHierarchy({
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

const User = require('../models/User');
const InviteToken = require('../models/InviteToken');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { withTransaction } = require('../utils/withTransaction');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, inviteToken } = req.body;

  if (!inviteToken) {
    throw new AppError('INVITE_REQUIRED', 'A valid invite token is required to register.', 403);
  }

  const invite = await InviteToken.findOne({
    token: inviteToken,
    active: true,
    usedAt: null,
    expiresAt: { $gt: new Date() }
  });

  if (!invite) {
    throw new AppError('INVITE_INVALID', 'Invite link is invalid or has expired.', 410);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('USER_EXISTS', 'User already exists with this email', 400);
  }

  const user = await withTransaction(async (session) => {
    const [doc] = await User.create(
      [{
        name,
        email,
        password,
        role: invite.assignedRole || 'user',
        operationalRole: invite.assignedOperationalRole,
        unitId: invite.unitId,
        companyId: invite.companyId,
        teamId: invite.teamId,
        squadId: invite.squadId,
        status: 'active',
        active: true
      }],
      { session }
    );

    invite.usedAt = new Date();
    invite.usedBy = doc._id;
    await invite.save({ session });

    return doc;
  });

  const token = generateToken(user._id);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { user }
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  if (user.status === 'pending') {
    throw new AppError('AUTH_PENDING', 'Your account is awaiting approval.', 403);
  }

  if (user.status === 'rejected') {
    throw new AppError('AUTH_REJECTED', 'Your account registration was rejected.', 403);
  }

  if (user.active === false) {
    throw new AppError('AUTH_INACTIVE', 'User account is inactive.', 403);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const token = generateToken(user._id);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: { user }
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: req.userDoc || req.user }
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = {
  register,
  login,
  getMe,
  logout,
};

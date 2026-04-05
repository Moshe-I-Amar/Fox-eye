const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resolveUserScope } = require('../services/scopeResolver');

const parseCookieToken = (cookieHeader = '') => {
  for (const part of cookieHeader.split(';')) {
    const [key, ...val] = part.trim().split('=');
    if (key.trim() === 'token') return decodeURIComponent(val.join('=').trim());
  }
  return null;
};

const authenticateSocket = async (socket, next) => {
  try {
    const cookieToken = parseCookieToken(socket.handshake.headers.cookie || '');
    const token = cookieToken
      || socket.handshake.auth.token
      || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = user._id.toString();
    socket.userRole = user.role;
    socket.userInfo = user;
    socket.userScope = await resolveUserScope(user);
    socket.sessionType = socket.handshake.query?.sessionType === 'MOBILE' ? 'MOBILE' : 'WEB';

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication error: Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired'));
    }
    next(new Error('Authentication error: Server error'));
  }
};

module.exports = { authenticateSocket };

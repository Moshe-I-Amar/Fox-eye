const User = require('../models/User');
const { AppError } = require('../utils/errors');
const { LocationService } = require('./locationService');
const { getSocketService } = require('../realtime/socket');

const locationService = new LocationService();

/**
 * Returns a paginated list of users within the requesting user's scope.
 */
const getUsers = async ({ scopeQuery, page, limit }) => {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(scopeQuery).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(scopeQuery)
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Returns a single user by ID, excluding the password field.
 */
const getUserById = async (id) => {
  const user = await User.findById(id).select('-password');
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }
  return user;
};

/**
 * Returns users within a given radius using a geospatial aggregation.
 * Distance is returned in kilometres (rounded to 2 decimal places).
 */
const ACTIVE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

const getUsersNearby = async ({ lat, lng, maxDistanceKm, scopeQuery }) => {
  const maxDistance = maxDistanceKm * 1000; // convert km → metres for MongoDB

  // Only return users who are currently online OR were seen within the last hour
  const presenceFilter = {
    $or: [
      { online: true },
      { lastSeen: { $gte: new Date(Date.now() - ACTIVE_THRESHOLD_MS) } }
    ]
  };

  const geoQuery =
    scopeQuery && Object.keys(scopeQuery).length > 0
      ? { $and: [scopeQuery, presenceFilter] }
      : presenceFilter;

  return User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distance',
        maxDistance,
        spherical: true,
        query: geoQuery
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        role: 1,
        operationalRole: 1,
        unitId: 1,
        companyId: 1,
        teamId: 1,
        squadId: 1,
        location: 1,
        online: 1,
        lastSeen: 1,
        createdAt: 1,
        distance: { $round: [{ $divide: ['$distance', 1000] }, 2] }
      }
    },
    { $sort: { distance: 1 } }
  ]);
};

/**
 * Updates the authenticated user's location and broadcasts via socket.
 */
const updateUserLocation = async ({ userId, coordinates, excludeSocketId }) => {
  let socketService = null;
  try {
    socketService = getSocketService();
  } catch (err) {
    console.warn('Socket unavailable for location:update:', err.message);
  }

  return locationService.updateUserLocation({
    userId,
    coordinates,
    socketService,
    excludeSocketId,
    suppressSocketErrors: true
  });
};

module.exports = { getUsers, getUserById, getUsersNearby, updateUserLocation };

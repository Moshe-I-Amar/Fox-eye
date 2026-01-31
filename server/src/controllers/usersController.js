const User = require('../models/User');
const { getSocketService } = require('../realtime/socket');
const { buildScopeQuery } = require('../utils/filterByScope');
const { LocationService } = require('../services/locationService');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');

const locationService = new LocationService();

const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    const emptyPagination = { page, limit, total: 0, pages: 0 };
    return res.json({
      success: true,
      data: { users: [], pagination: emptyPagination },
      pagination: emptyPagination
    });
  }

  const users = await User.find(scopeQuery)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(scopeQuery);
  const pagination = {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit)
  };

  res.json({
    success: true,
    data: { users, pagination },
    pagination
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  res.json({
    success: true,
    data: { user }
  });
});

const getUsersNearby = asyncHandler(async (req, res) => {
  const { lat, lng, distance = 10 } = req.query;

  if (!lat || !lng) {
    throw new AppError('VALIDATION_ERROR', 'Latitude and longitude are required', 400);
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const maxDistance = parseFloat(distance) * 1000;

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid coordinates', 400);
  }

  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    return res.json({
      success: true,
      data: {
        users: [],
        center: {
          lat: latitude,
          lng: longitude,
          radius: parseFloat(distance)
        }
      }
    });
  }

  const users = await User.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [longitude, latitude]
        },
        distanceField: "distance",
        maxDistance: maxDistance,
        spherical: true,
        query: scopeQuery
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        role: 1,
        location: 1,
        createdAt: 1,
        distance: { $round: [{ $divide: ["$distance", 1000] }, 2] }
      }
    },
    {
      $sort: { distance: 1 }
    }
  ]);

  res.json({
    success: true,
    data: {
      users,
      center: {
        lat: latitude,
        lng: longitude,
        radius: parseFloat(distance)
      }
    }
  });
});

const updateMyLocation = asyncHandler(async (req, res) => {
  const { coordinates } = req.body;
  let socketService = null;
  try {
    socketService = getSocketService();
  } catch (socketError) {
    console.warn('Socket emit failed for location:update:', socketError.message);
  }
  const socketId = req.headers['x-socket-id'];
  const { user, ao } = await locationService.updateUserLocation({
    userId: req.user?.id,
    coordinates,
    socketService,
    excludeSocketId: socketId,
    suppressSocketErrors: true
  });

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      user,
      ao
    }
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  getUsersNearby,
  updateMyLocation
};

const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { buildScopeQuery } = require('../utils/filterByScope');
const userService = require('../services/userService');

const EMPTY_PAGINATION = (page, limit) => ({ page, limit, total: 0, pages: 0 });

const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    const pagination = EMPTY_PAGINATION(page, limit);
    return res.json({ success: true, data: { users: [], pagination }, pagination });
  }

  const result = await userService.getUsers({ scopeQuery, page, limit });
  res.json({ success: true, data: result, pagination: result.pagination });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.json({ success: true, data: { user } });
});

const getUsersNearby = asyncHandler(async (req, res) => {
  const { lat, lng, distance = 10 } = req.query;

  if (!lat || !lng) {
    throw new AppError('VALIDATION_ERROR', 'Latitude and longitude are required', 400);
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const maxDistanceKm = parseFloat(distance);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid coordinates', 400);
  }

  const scopeQuery = buildScopeQuery(req.scope);
  if (!scopeQuery) {
    return res.json({
      success: true,
      data: { users: [], center: { lat: latitude, lng: longitude, radius: maxDistanceKm } }
    });
  }

  const users = await userService.getUsersNearby({ lat: latitude, lng: longitude, maxDistanceKm, scopeQuery });

  res.json({
    success: true,
    data: { users, center: { lat: latitude, lng: longitude, radius: maxDistanceKm } }
  });
});

const updateMyLocation = asyncHandler(async (req, res) => {
  const { coordinates } = req.body;
  const excludeSocketId = req.headers['x-socket-id'];

  const { user, ao } = await userService.updateUserLocation({
    userId: req.user?.id,
    coordinates,
    excludeSocketId
  });

  res.json({ success: true, message: 'Location updated successfully', data: { user, ao } });
});

module.exports = { getAllUsers, getUserById, getUsersNearby, updateMyLocation };

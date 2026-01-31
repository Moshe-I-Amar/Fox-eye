const { body, validationResult } = require('express-validator');
const { AppError } = require('./errors');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('VALIDATION_ERROR', 'Validation failed', 400, errors.array()));
  }
  next();
};

const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('unitId')
    .optional()
    .isMongoId()
    .withMessage('Unit ID must be a valid Mongo ID'),
  body('companyId')
    .optional()
    .isMongoId()
    .withMessage('Company ID must be a valid Mongo ID'),
  body('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid Mongo ID'),
  body('squadId')
    .optional()
    .isMongoId()
    .withMessage('Squad ID must be a valid Mongo ID'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const validateLocation = [
  body('coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be an array of [longitude, latitude]'),
  body('coordinates.0')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('coordinates.1')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  handleValidationErrors
];

const validatePolygonShape = (polygon, { req }) => {
  if (!polygon || typeof polygon !== 'object') {
    throw new Error('Polygon is required');
  }

  if (polygon.type !== 'Polygon') {
    throw new Error('Polygon type must be "Polygon"');
  }

  const { coordinates } = polygon;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('Polygon coordinates are required');
  }

  const MAX_RING_POINTS = 2000;

  const isValid = coordinates.every((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      return false;
    }
    if (ring.length > MAX_RING_POINTS) {
      throw new Error(`Polygon ring exceeds ${MAX_RING_POINTS} points`);
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!Array.isArray(first) || !Array.isArray(last) || first.length < 2 || last.length < 2) {
      return false;
    }
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new Error('Polygon ring must be closed');
    }

    return ring.every((point) => {
      if (!Array.isArray(point) || point.length < 2) {
        return false;
      }
      const [lng, lat] = point;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return false;
      }
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error('Polygon coordinates must be [longitude, latitude] within valid ranges');
      }
      return true;
    });
  });

  if (!isValid) {
    throw new Error('Polygon coordinates must be an array of valid coordinate pairs');
  }

  return true;
};

const validateAOCreate = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('polygon').custom(validatePolygonShape),
  body('companyId')
    .if((value, { req }) => req?.user?.role === 'admin')
    .isMongoId()
    .withMessage('Company ID is required'),
  body('companyId')
    .if((value, { req }) => req?.user?.role !== 'admin')
    .optional()
    .isMongoId()
    .withMessage('Company ID must be a valid Mongo ID'),
  body('style')
    .optional()
    .isObject()
    .withMessage('Style must be an object'),
  body('style.color')
    .optional()
    .isString()
    .trim()
    .withMessage('Style color must be a string'),
  body('style.pattern')
    .optional()
    .isString()
    .trim()
    .withMessage('Style pattern must be a string'),
  body('style.icon')
    .optional()
    .isString()
    .trim()
    .withMessage('Style icon must be a string'),
  handleValidationErrors
];

const validateAOUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('polygon')
    .optional()
    .custom(validatePolygonShape),
  body('companyId')
    .optional()
    .isMongoId()
    .withMessage('Company ID must be a valid Mongo ID'),
  body('style')
    .optional()
    .isObject()
    .withMessage('Style must be an object'),
  body('style.color')
    .optional()
    .isString()
    .trim()
    .withMessage('Style color must be a string'),
  body('style.pattern')
    .optional()
    .isString()
    .trim()
    .withMessage('Style pattern must be a string'),
  body('style.icon')
    .optional()
    .isString()
    .trim()
    .withMessage('Style icon must be a string'),
  handleValidationErrors
];

const validateAOActive = [
  body('active')
    .isBoolean()
    .withMessage('Active must be a boolean')
    .toBoolean(),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateLocation,
  validateAOCreate,
  validateAOUpdate,
  validateAOActive,
  handleValidationErrors
};

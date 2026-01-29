const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);

  const requestId = req.id || req.header('x-request-id');
  const response = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal Server Error'
    }
  };

  if (requestId) {
    response.error.requestId = requestId;
  }

  let statusCode = err.statusCode || err.status || 500;

  if (err.isAppError && err.code) {
    response.error.code = err.code;
    response.error.message = err.message || response.error.message;
    if (err.details !== undefined) {
      response.error.details = err.details;
    }
    statusCode = err.statusCode || statusCode;
    return res.status(statusCode).json(response);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((error) => error.message);
    response.error.code = 'VALIDATION_ERROR';
    response.error.message = 'Validation Error';
    response.error.details = errors;
    return res.status(400).json(response);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    response.error.code = 'DUPLICATE_KEY';
    response.error.message = field ? `${field} already exists` : 'Duplicate key error';
    return res.status(400).json(response);
  }

  if (err.name === 'CastError') {
    response.error.code = 'INVALID_ID';
    response.error.message = 'Invalid ID format';
    return res.status(400).json(response);
  }

  if (err.name === 'JsonWebTokenError') {
    response.error.code = 'AUTH_INVALID_TOKEN';
    response.error.message = 'Invalid token.';
    return res.status(401).json(response);
  }

  if (err.name === 'TokenExpiredError') {
    response.error.code = 'AUTH_TOKEN_EXPIRED';
    response.error.message = 'Token expired.';
    return res.status(401).json(response);
  }

  response.error.message = err.message || response.error.message;
  res.status(statusCode).json(response);
};

module.exports = errorHandler;

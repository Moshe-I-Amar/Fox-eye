require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { AppError } = require('./utils/errors');
const { initSocket, closeSocket, getIO } = require('./realtime/socket');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const aoRoutes = require('./routes/aoRoutes');
const hierarchyRoutes = require('./routes/hierarchyRoutes');
const violationRoutes = require('./routes/violationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const PORT = process.env.PORT || 5000;

const createApp = () => {
  const app = express();

  app.use(helmet());

  const corsOptions = {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true
  };
  app.use(cors(corsOptions));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const log = {
        level: 'info',
        message: 'request',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        requestId: req.id || req.header('x-request-id') || null
      };
      console.log(JSON.stringify(log));
    });
    next();
  });

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests from this IP, please try again later.'
      }
    }
  });
  app.use('/api/', limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts, please try again later.'
      }
    }
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    let socketStatus = { initialized: false, clients: 0 };
    try {
      const io = getIO();
      socketStatus = {
        initialized: true,
        clients: io.engine?.clientsCount ?? io.sockets?.sockets?.size ?? 0
      };
    } catch (error) {
      socketStatus = { initialized: false, clients: 0 };
    }

    res.json({
      success: true,
      message: 'Server is running',
      data: {
        timestamp: new Date().toISOString(),
        db: {
          status: dbStatus,
          readyState: dbState
        },
        socket: socketStatus
      }
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/hierarchy', hierarchyRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/aos', aoRoutes);
  app.use('/api/violations', violationRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('*', (req, res, next) => {
    next(new AppError('NOT_FOUND', 'Route not found', 404));
  });

  app.use(errorHandler);

  return app;
};

const startServer = async () => {
  const app = createApp();
  await connectDB();

  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve, reject) => {
    server.listen(PORT, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(`Server is running on port ${PORT}`);
      resolve();
    });
  });

  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);

    const forceTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit.');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    try {
      await closeSocket();
      await new Promise((resolve) => server.close(resolve));
      await disconnectDB();
      clearTimeout(forceTimer);
      console.log('Shutdown complete.');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return { app, server };
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server failed to start:', error);
    process.exitCode = 1;
  });
}

module.exports = { createApp, startServer };

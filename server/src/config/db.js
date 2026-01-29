const mongoose = require('mongoose');

const parseEnvInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectWithRetry = async ({ maxRetries, delayMs }) => {
  let attempt = 0;
  let currentDelay = delayMs;

  while (true) {
    try {
      attempt += 1;
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`Database connection error (attempt ${attempt})`, error);

      if (maxRetries !== Infinity && attempt >= maxRetries) {
        throw error;
      }

      const retriesLeft = maxRetries === Infinity ? '∞' : Math.max(maxRetries - attempt, 0);
      console.warn(`Retrying MongoDB connection in ${currentDelay}ms (retries left: ${retriesLeft})`);
      await sleep(currentDelay);
      currentDelay = Math.min(currentDelay * 2, 30000);
    }
  }
};

const connectDB = async (options = {}) => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set');
  }

  const isProd = process.env.NODE_ENV === 'production';
  const retryEnabled = options.retryEnabled ?? isProd;
  const maxRetries =
    options.maxRetries ??
    (retryEnabled
      ? (process.env.DB_CONNECT_RETRIES
          ? parseEnvInt(process.env.DB_CONNECT_RETRIES, Infinity)
          : Infinity)
      : 0);
  const delayMs =
    options.delayMs ??
    (process.env.DB_CONNECT_RETRY_DELAY_MS
      ? parseEnvInt(process.env.DB_CONNECT_RETRY_DELAY_MS, 2000)
      : 2000);

  if (!retryEnabled) {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  }

  return connectWithRetry({ maxRetries, delayMs });
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close(false);
  console.log('MongoDB connection closed');
};

module.exports = { connectDB, disconnectDB };

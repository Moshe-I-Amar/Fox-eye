const mongoose = require('mongoose');

/**
 * Runs `fn(session)` inside a MongoDB transaction.
 *
 * Falls back to running `fn(null)` without a transaction when the connected
 * MongoDB instance does not support transactions (e.g. a standalone dev server).
 * In production with a Replica Set, all writes inside `fn` are atomic.
 *
 * Usage:
 *   const result = await withTransaction(async (session) => {
 *     const doc = await Model.create([data], { session });
 *     await logAdminAction({ ..., session });
 *     return doc[0];
 *   });
 */
const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    // Standalone MongoDB does not support transactions — fall back gracefully.
    if (
      err.codeName === 'IllegalOperation' ||
      err.message?.includes('Transaction numbers') ||
      err.message?.includes('replica set')
    ) {
      return fn(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = { withTransaction };

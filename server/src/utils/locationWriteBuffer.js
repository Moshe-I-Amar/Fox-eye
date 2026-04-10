'use strict';

const User = require('../models/User');

/**
 * LocationWriteBuffer — batches high-frequency GPS location writes into a
 * single bulkWrite every flushIntervalMs milliseconds.
 *
 * During mass mobilization (100 users @ 1 Hz) the naive User.save() path
 * produces 100 individual writes/sec. This buffer collapses that into
 * ~1 bulkWrite every 500 ms with up to 100 entries — a ~98% write reduction.
 *
 * Broadcast (socket fanout) still happens immediately; only DB persistence
 * is deferred. Last write wins within the flush window — correct for GPS.
 *
 * Env:
 *   LOCATION_WRITE_BUFFER_MS  flush interval in ms (default 500)
 */
class LocationWriteBuffer {
  constructor({ userModel, flushIntervalMs } = {}) {
    this.userModel = userModel || User;
    this.flushIntervalMs =
      Number(process.env.LOCATION_WRITE_BUFFER_MS) || flushIntervalMs || 500;

    // userId (string) -> [lng, lat] — later enqueues overwrite earlier ones
    this.buffer = new Map();
    this.timer = null;

    // Diagnostics
    this._totalFlushes = 0;
    this._totalWrites = 0;

    // Graceful shutdown — flush remaining entries on SIGTERM / SIGINT
    this._onShutdown = () => this.shutdown().catch(() => {});
    process.once('SIGTERM', this._onShutdown);
    process.once('SIGINT', this._onShutdown);
  }

  /**
   * Queue a location write for userId. Overwrites any pending write for the
   * same user within the current flush window.
   * @param {string|ObjectId} userId
   * @param {[number, number]} coordinates  [lng, lat]
   */
  enqueue(userId, coordinates) {
    this.buffer.set(String(userId), coordinates);
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this._flush().catch((err) => {
        console.error('[LocationWriteBuffer] flush error:', err.message);
      });
    }, this.flushIntervalMs);
  }

  async _flush() {
    if (!this.buffer.size) return;

    const entries = Array.from(this.buffer.entries());
    this.buffer.clear();

    const ops = entries.map(([userId, coordinates]) => ({
      updateOne: {
        filter: { _id: userId },
        update: { $set: { location: { type: 'Point', coordinates } } }
      }
    }));

    this._totalFlushes++;
    this._totalWrites += entries.length;

    try {
      await this.userModel.bulkWrite(ops, { ordered: false });
    } catch (err) {
      console.error(
        `[LocationWriteBuffer] bulkWrite failed (${entries.length} op(s)): ${err.message}`
      );
    }
  }

  /**
   * Drain remaining entries and stop the timer.
   * Called on process shutdown — ensures last known location is persisted.
   */
  async shutdown() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.size > 0) {
      console.log(
        `[LocationWriteBuffer] shutdown: flushing ${this.buffer.size} pending write(s)`
      );
      await this._flush();
    }
    process.off('SIGTERM', this._onShutdown);
    process.off('SIGINT', this._onShutdown);
  }

  /**
   * Diagnostic snapshot — available for health checks or logging.
   */
  getStats() {
    return {
      pending: this.buffer.size,
      flushIntervalMs: this.flushIntervalMs,
      totalFlushes: this._totalFlushes,
      totalWrites: this._totalWrites
    };
  }
}

module.exports = LocationWriteBuffer;

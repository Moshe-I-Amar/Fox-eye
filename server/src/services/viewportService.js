const { filterUsersByScope } = require('../utils/filterByScope');
const {
  normalizeBounds,
  getCellSizeForZoom,
  getCellId,
  getCellsForBounds,
  isPointInBounds,
  MAX_CELLS_PER_SUBSCRIPTION
} = require('../utils/grid');

class ViewportService {
  constructor({ io, presenceService, viewportThrottleMs = 250 } = {}) {
    if (!io) {
      throw new Error('ViewportService requires a socket.io instance');
    }
    if (!presenceService) {
      throw new Error('ViewportService requires a presence service');
    }

    this.io = io;
    this.presenceService = presenceService;
    this.socketViewports = new Map(); // socket.id -> viewport
    this.socketViewportRooms = new Map(); // socket.id -> Set(room)
    this.gridCellSizeCounts = new Map(); // cellSize -> count
    this.lastViewportUpdateAt = new Map(); // socket.id -> timestamp
    this.viewportThrottleMs = viewportThrottleMs;
    this.viewportRateLimits = new Map(); // socket.id -> { windowStart, count }
    this.viewportWindowMs = Number(process.env.SOCKET_VIEWPORT_WINDOW_MS) || 10000;
    this.viewportMaxPerWindow = Number(process.env.SOCKET_VIEWPORT_MAX_PER_WINDOW) || 40;
  }

  async handleViewportSubscription(socket, data) {
    const now = Date.now();
    const lastUpdate = this.lastViewportUpdateAt.get(socket.id) || 0;
    if (now - lastUpdate < this.viewportThrottleMs) {
      return;
    }
    this.lastViewportUpdateAt.set(socket.id, now);
    if (!this.allowViewportUpdate(socket.id, now)) {
      return;
    }

    if (!data) {
      throw new Error('Viewport payload is required');
    }

    const {
      minLat,
      minLng,
      maxLat,
      maxLng,
      zoom
    } = data;

    if (![minLat, minLng, maxLat, maxLng].every((value) => Number.isFinite(value))) {
      throw new Error('Viewport bounds must be numbers');
    }

    const normalized = normalizeBounds({ minLat, minLng, maxLat, maxLng });
    const cellSize = getCellSizeForZoom(zoom);
    const { cells, truncated } = getCellsForBounds(normalized, cellSize, MAX_CELLS_PER_SUBSCRIPTION);

    if (truncated) {
      console.warn(`Viewport subscription truncated for socket ${socket.id} (${cells.size} cells)`);
    }

    const previousViewport = this.socketViewports.get(socket.id);
    if (previousViewport?.cellSize && previousViewport.cellSize !== cellSize) {
      this.decrementCellSizeCount(previousViewport.cellSize);
    }
    if (!previousViewport?.cellSize || previousViewport.cellSize !== cellSize) {
      this.incrementCellSizeCount(cellSize);
    }

    const nextRooms = cells;
    const previousRooms = this.socketViewportRooms.get(socket.id) || new Set();

    for (const room of previousRooms) {
      if (!nextRooms.has(room)) {
        socket.leave(room);
      }
    }

    for (const room of nextRooms) {
      if (!previousRooms.has(room)) {
        socket.join(room);
      }
    }

    this.socketViewportRooms.set(socket.id, nextRooms);
    this.socketViewports.set(socket.id, {
      ...normalized,
      zoom,
      cellSize
    });
  }

  handleDisconnect(socket) {
    const viewport = this.socketViewports.get(socket.id);
    if (viewport?.cellSize) {
      this.decrementCellSizeCount(viewport.cellSize);
    }
    this.socketViewports.delete(socket.id);
    this.socketViewportRooms.delete(socket.id);
    this.lastViewportUpdateAt.delete(socket.id);
    this.viewportRateLimits.delete(socket.id);
  }

  allowViewportUpdate(socketId, now = Date.now()) {
    const state = this.viewportRateLimits.get(socketId) || {
      windowStart: now,
      count: 0
    };

    if (now - state.windowStart > this.viewportWindowMs) {
      state.windowStart = now;
      state.count = 0;
    }

    state.count += 1;
    this.viewportRateLimits.set(socketId, state);
    return state.count <= this.viewportMaxPerWindow;
  }

  incrementCellSizeCount(cellSize) {
    const nextCount = (this.gridCellSizeCounts.get(cellSize) || 0) + 1;
    this.gridCellSizeCounts.set(cellSize, nextCount);
  }

  decrementCellSizeCount(cellSize) {
    const nextCount = (this.gridCellSizeCounts.get(cellSize) || 0) - 1;
    if (nextCount <= 0) {
      this.gridCellSizeCounts.delete(cellSize);
    } else {
      this.gridCellSizeCounts.set(cellSize, nextCount);
    }
  }

  async emitLocationUpdateToSubscribers({ minimalUpdate, locationUpdate, excludeSocketId }) {
    const [longitude, latitude] = minimalUpdate.coordinates;
    const candidateSockets = new Map();
    const targetProfile = this.presenceService.getUserProfile(minimalUpdate.userId);

    if (!targetProfile) {
      return;
    }

    for (const cellSize of this.gridCellSizeCounts.keys()) {
      const room = getCellId(latitude, longitude, cellSize);
      const sockets = await this.io.in(room).fetchSockets();
      for (const socket of sockets) {
        candidateSockets.set(socket.id, socket);
      }
    }

    for (const socket of candidateSockets.values()) {
      if (excludeSocketId && socket.id === excludeSocketId) {
        continue;
      }
      const viewport = this.socketViewports.get(socket.id);
      if (!viewport) {
        continue;
      }
      if (!isPointInBounds(viewport, latitude, longitude)) {
        continue;
      }
      const recipientInfo = this.presenceService.getUserSocketInfo(socket.id);
      if (!recipientInfo) {
        continue;
      }
      const isSelf = recipientInfo.userId === minimalUpdate.userId;
      if (!isSelf && filterUsersByScope([targetProfile], recipientInfo.userScope).length === 0) {
        continue;
      }
      socket.emit('location:update', minimalUpdate);
      socket.emit('location:updated', locationUpdate);
    }

    for (const [socketId, recipientInfo] of this.presenceService.getUserSocketEntries()) {
      if (recipientInfo.role !== 'admin') {
        continue;
      }
      const isSelf = recipientInfo.userId === minimalUpdate.userId;
      if (!isSelf && filterUsersByScope([targetProfile], recipientInfo.userScope).length === 0) {
        continue;
      }
      this.io.to(socketId).emit('admin:location:updated', locationUpdate);
    }
  }
}

module.exports = ViewportService;

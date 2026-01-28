const DEFAULT_CELL_SIZE_DEG = 0.25;
const MAX_CELLS_PER_SUBSCRIPTION = 400;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeBounds = ({ minLat, minLng, maxLat, maxLng }) => {
  let normalizedMinLat = clamp(minLat, -90, 90);
  let normalizedMaxLat = clamp(maxLat, -90, 90);
  let normalizedMinLng = clamp(minLng, -180, 180);
  let normalizedMaxLng = clamp(maxLng, -180, 180);

  if (normalizedMinLat > normalizedMaxLat) {
    [normalizedMinLat, normalizedMaxLat] = [normalizedMaxLat, normalizedMinLat];
  }

  if (normalizedMinLng > normalizedMaxLng) {
    [normalizedMinLng, normalizedMaxLng] = [normalizedMaxLng, normalizedMinLng];
  }

  return {
    minLat: normalizedMinLat,
    minLng: normalizedMinLng,
    maxLat: normalizedMaxLat,
    maxLng: normalizedMaxLng
  };
};

const getCellSizeForZoom = (zoom) => {
  if (typeof zoom !== 'number' || Number.isNaN(zoom)) {
    return DEFAULT_CELL_SIZE_DEG;
  }

  if (zoom >= 15) return 0.01;
  if (zoom >= 13) return 0.05;
  if (zoom >= 11) return 0.1;
  if (zoom >= 9) return 0.25;
  if (zoom >= 7) return 0.5;
  if (zoom >= 5) return 1;
  if (zoom >= 3) return 2;
  return 5;
};

const getCellId = (lat, lng, cellSize = DEFAULT_CELL_SIZE_DEG) => {
  const latIndex = Math.floor((lat + 90) / cellSize);
  const lngIndex = Math.floor((lng + 180) / cellSize);
  return `grid:${cellSize}:${latIndex}:${lngIndex}`;
};

const getCellsForBounds = (bounds, cellSize = DEFAULT_CELL_SIZE_DEG, maxCells = MAX_CELLS_PER_SUBSCRIPTION) => {
  const { minLat, minLng, maxLat, maxLng } = normalizeBounds(bounds);

  const minLatIndex = Math.floor((minLat + 90) / cellSize);
  const maxLatIndex = Math.floor((maxLat + 90) / cellSize);
  const minLngIndex = Math.floor((minLng + 180) / cellSize);
  const maxLngIndex = Math.floor((maxLng + 180) / cellSize);

  const cells = new Set();

  for (let latIndex = minLatIndex; latIndex <= maxLatIndex; latIndex += 1) {
    for (let lngIndex = minLngIndex; lngIndex <= maxLngIndex; lngIndex += 1) {
      cells.add(`grid:${cellSize}:${latIndex}:${lngIndex}`);
      if (cells.size >= maxCells) {
        return { cells, truncated: true };
      }
    }
  }

  return { cells, truncated: false };
};

const isPointInBounds = (bounds, lat, lng) => {
  if (!bounds) {
    return false;
  }

  const { minLat, minLng, maxLat, maxLng } = normalizeBounds(bounds);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
};

module.exports = {
  DEFAULT_CELL_SIZE_DEG,
  MAX_CELLS_PER_SUBSCRIPTION,
  normalizeBounds,
  getCellSizeForZoom,
  getCellId,
  getCellsForBounds,
  isPointInBounds
};

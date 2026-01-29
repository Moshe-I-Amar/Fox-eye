const AO = require('../models/AO');

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (value) => (value * Math.PI) / 180;

const isPointInPolygon = (point, polygon) => {
  if (!point || !polygon?.coordinates?.[0]?.length) {
    return false;
  }

  const [x, y] = point;
  const ring = polygon.coordinates[0];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const toMeters = (lng, lat, refLat) => {
  const latRad = toRadians(lat);
  const lngRad = toRadians(lng);
  const refLatRad = toRadians(refLat);

  return {
    x: EARTH_RADIUS_METERS * lngRad * Math.cos(refLatRad),
    y: EARTH_RADIUS_METERS * latRad
  };
};

const distancePointToSegmentMeters = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const projX = start.x + clamped * dx;
  const projY = start.y + clamped * dy;

  return Math.hypot(point.x - projX, point.y - projY);
};

const distanceToPolygonMeters = (point, polygon) => {
  if (!point || !polygon?.coordinates?.[0]?.length) {
    return null;
  }

  if (isPointInPolygon(point, polygon)) {
    return 0;
  }

  const ring = polygon.coordinates[0];
  if (ring.length < 2) {
    return null;
  }

  const [lng, lat] = point;
  const pointMeters = toMeters(lng, lat, lat);
  let minDistance = Infinity;

  for (let i = 0; i < ring.length; i += 1) {
    const [startLng, startLat] = ring[i];
    const [endLng, endLat] = ring[(i + 1) % ring.length];
    const startMeters = toMeters(startLng, startLat, lat);
    const endMeters = toMeters(endLng, endLat, lat);
    const distance = distancePointToSegmentMeters(pointMeters, startMeters, endMeters);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return Number.isFinite(minDistance) ? minDistance : null;
};

const isPointNearPolygon = (point, polygon, toleranceMeters = 0) => {
  const tolerance = Number(toleranceMeters) || 0;
  if (tolerance <= 0) {
    return false;
  }

  const distance = distanceToPolygonMeters(point, polygon);
  if (distance === null) {
    return false;
  }

  return distance <= tolerance;
};

const findAoForPoint = (point, aos) => {
  if (!point || !Array.isArray(aos) || aos.length === 0) {
    return null;
  }

  for (const ao of aos) {
    if (isPointInPolygon(point, ao?.polygon)) {
      return ao;
    }
  }

  return null;
};

const findAoForPointWithTolerance = (point, aos, toleranceMeters = 0) => {
  if (!point || !Array.isArray(aos) || aos.length === 0) {
    return null;
  }

  for (const ao of aos) {
    if (isPointInPolygon(point, ao?.polygon)) {
      return ao;
    }
  }

  if (Number(toleranceMeters) > 0) {
    for (const ao of aos) {
      if (isPointNearPolygon(point, ao?.polygon, toleranceMeters)) {
        return ao;
      }
    }
  }

  return null;
};

const getAoForPoint = async ({ point, companyId }) => {
  if (!companyId || !point) {
    return null;
  }

  const fields = 'name polygon active';
  const [activeAos, inactiveAos] = await Promise.all([
    AO.find({ companyId, active: true }, fields).lean(),
    AO.find({ companyId, active: false }, fields).lean()
  ]);

  return findAoForPoint(point, activeAos) || findAoForPoint(point, inactiveAos);
};

const getActiveAos = async ({ companyId, fields = '_id name polygon active' } = {}) => {
  if (!companyId) {
    return [];
  }

  return AO.find({ companyId, active: true }, fields).lean();
};

const toAoSummary = (ao) => {
  if (!ao) {
    return null;
  }

  return {
    id: ao._id?.toString?.() || String(ao._id),
    name: ao.name,
    active: ao.active
  };
};

module.exports = {
  isPointInPolygon,
  distanceToPolygonMeters,
  isPointNearPolygon,
  getAoForPoint,
  getActiveAos,
  findAoForPointWithTolerance,
  toAoSummary
};

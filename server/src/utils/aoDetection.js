const AO = require('../models/AO');

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
  getAoForPoint,
  toAoSummary
};

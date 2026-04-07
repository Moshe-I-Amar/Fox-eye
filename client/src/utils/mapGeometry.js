/** Geometry helpers — coordinate conversion and polygon math. */

export const isPointInPolygon = (point, polygon) => {
  if (!point || !polygon?.coordinates?.[0]?.length) return false;
  const [x, y] = point;
  const ring = polygon.coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const findAoForPoint = (point, aos) => {
  if (!point || !Array.isArray(aos) || aos.length === 0) return null;
  for (const ao of aos.filter((a) => a?.active)) {
    if (isPointInPolygon(point, ao?.polygon)) return ao;
  }
  for (const ao of aos.filter((a) => !a?.active)) {
    if (isPointInPolygon(point, ao?.polygon)) return ao;
  }
  return null;
};

export const toGeoPolygon = (latLngs) => {
  if (!Array.isArray(latLngs) || latLngs.length === 0) return null;
  const ring = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
  if (!Array.isArray(ring) || ring.length === 0) return null;
  const coordinates = ring.map((p) => [p.lng, p.lat]);
  if (coordinates.length > 2) {
    const [fLng, fLat] = coordinates[0];
    const [lLng, lLat] = coordinates[coordinates.length - 1];
    if (fLng !== lLng || fLat !== lLat) coordinates.push([fLng, fLat]);
  }
  return { type: 'Polygon', coordinates: [coordinates] };
};

export const toLatLngs = (polygon) => {
  if (!polygon?.coordinates?.[0]) return [];
  return polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
};

/** Haversine distance between two [lat, lng] pairs, in km (2 decimal places). */
export const calculateDistance = (center, userCoords) => {
  const [lat1, lon1] = center;
  const [lat2, lon2] = userCoords;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
};

/** Convert [lng, lat] (GeoJSON) to [lat, lng] (Leaflet). */
export const normalizeCoords = (raw) => {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const [lng, lat] = raw;
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

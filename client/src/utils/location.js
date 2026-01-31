export const isValidCoords = (coords) => {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    coords.every((value) => typeof value === 'number' && Number.isFinite(value))
  );
};

export const safeGetCoords = (user) => {
  const coords = user?.location?.coordinates;
  return isValidCoords(coords) ? coords : null;
};

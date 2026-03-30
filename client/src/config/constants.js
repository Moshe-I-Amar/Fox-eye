// Centralised constants — import from here instead of hardcoding in components

// Map defaults
export const DEFAULT_MAP_CENTER = [40.7128, -74.006]; // NYC fallback
export const DEFAULT_MAP_ZOOM = 13;
export const DEFAULT_SEARCH_RADIUS_KM = 10;

// AO styling
export const DEFAULT_AO_COLOR = '#C7A76C';
export const DEFAULT_AO_ICON = '';
export const AO_ICON_MAX_LENGTH = 6;
export const AO_NAME_MIN = 2;
export const AO_NAME_MAX = 100;

// Breach detection
export const AO_BREACH_GRACE_MS = 5000;
export const APPROACHING_BOUNDARY_DISTANCE_M = 50;

// Marker sizes
export const MARKER_SIZE = 32;

// Realtime
export const VIEWPORT_DEBOUNCE_MS = 250;
export const HEALTH_POLL_INTERVAL_MS = 30_000;

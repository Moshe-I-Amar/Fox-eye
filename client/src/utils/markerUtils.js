import { Icon } from 'leaflet';
import { DEFAULT_AO_COLOR, DEFAULT_AO_ICON, AO_ICON_MAX_LENGTH } from '../config/constants';

// ── String / security helpers ─────────────────────────────────────────────────
export const escapeXml = (v = '') =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const isImageUrl = (v = '') =>
  /^(data:image\/(?!svg\+xml)[a-z0-9+.-]+;|https?:\/\/|\/[^/]|blob:)/i.test(v.trim());

export const sanitizeColor = (v = '') => {
  const t = (v || '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) return t;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+)?\s*\)$/.test(t)) return t;
  return DEFAULT_AO_COLOR;
};

export const isValidIconValue = (v = '') => {
  const t = v.trim();
  if (!t) return true;
  if (isImageUrl(t)) return true;
  return t.length <= AO_ICON_MAX_LENGTH;
};

export const svgToDataUrl = (svg) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

// ── Role icons / labels ───────────────────────────────────────────────────────
export const ROLE_ICON = {
  HQ: `<polygon points="19,9 21.2,15.9 27.6,16.2 22.6,20.2 24.3,26.3 19,22.8 13.7,26.3 15.4,20.2 10.4,16.2 16.8,15.9" fill="white" fill-opacity="0.95"/>`,
  UNIT_COMMANDER: `<rect x="10" y="12" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/><rect x="10" y="17.5" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/><rect x="10" y="23" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/>`,
  COMPANY_COMMANDER: `<rect x="10" y="14" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/><rect x="10" y="21" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/>`,
  TEAM_LEADER: `<path d="M8 25 L19 11 L30 25" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.95"/>`,
  TEAM_COMMANDER: `<path d="M8 25 L19 11 L30 25" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.95"/>`,
  SQUAD_COMMANDER: `<polygon points="19,9 29,19 19,29 9,19" fill="white" fill-opacity="0.95"/>`,
};

export const ROLE_LABEL = {
  HQ: 'HQ', UNIT_COMMANDER: 'Unit Commander', COMPANY_COMMANDER: 'Company Commander',
  TEAM_LEADER: 'Team Leader', TEAM_COMMANDER: 'Team Commander', SQUAD_COMMANDER: 'Squad Commander',
};

// ── SVG builders ──────────────────────────────────────────────────────────────
export const buildUserPinSvg = ({ color, isOnline, operationalRole }) => {
  const c = sanitizeColor(color);
  const roleMarkup = ROLE_ICON[operationalRole] ?? `<circle cx="19" cy="14" r="5.5" fill="white" fill-opacity="0.95"/><path d="M7 29 C7 21 31 21 31 29" fill="white" fill-opacity="0.95"/>`;
  const dot = isOnline
    ? `<circle cx="29" cy="8" r="4.5" fill="#34d399" stroke="${c}" stroke-width="2"/>`
    : `<circle cx="29" cy="8" r="4.5" fill="#4b5563" stroke="${c}" stroke-width="2"/>`;
  return `<svg width="26" height="34" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><filter id="ps" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.55)"/></filter></defs><path d="M19 2 C9 2 1 10 1 20 C1 30 19 46 19 46 C19 46 37 30 37 20 C37 10 29 2 19 2Z" fill="${c}" filter="url(#ps)"/><circle cx="19" cy="19" r="13" fill="rgba(0,0,0,0.28)"/>${roleMarkup}${dot}</svg>`;
};

export const buildSelfDotSvg = ({ color }) => {
  const c = sanitizeColor(color);
  return `<svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="23" fill="${c}" fill-opacity="0.12"/><circle cx="24" cy="24" r="17" fill="${c}" fill-opacity="0.25"/><circle cx="24" cy="24" r="12" fill="${c}"/><circle cx="24" cy="24" r="12" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/><circle cx="24" cy="19" r="4" fill="#0a0a0a"/><path d="M13 33 C13 25 35 25 35 33" fill="#0a0a0a"/></svg>`;
};

export const buildAoPinSvg = ({ color, icon, iconUrl }) => {
  const c = sanitizeColor(color);
  const markup = iconUrl
    ? `<image href="${iconUrl}" x="7" y="5" width="10" height="10"/>`
    : icon
      ? `<text x="12" y="11" text-anchor="middle" dominant-baseline="middle" font-size="6" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif">${escapeXml(icon)}</text>`
      : `<circle cx="12" cy="10" r="2.5" fill="#ffffff"/>`;
  return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8 13 2 20 2 20C2 20 12 20 20 20C20 20 16 13 12 2Z" fill="${c}"/><circle cx="12" cy="10" r="4.5" fill="rgba(0,0,0,0.35)"/>${markup}</svg>`;
};

// ── Event marker config ────────────────────────────────────────────────────────
export const EVENT_TYPE_CONFIG = {
  INJURED: { color: '#ef4444', label: 'Injured', glyph: '✚', svgPath: `<path d="M19 11 L19 27 M11 19 L27 19" stroke="white" stroke-width="5" stroke-linecap="round"/>`,                                                                         alertTone: 'error', autoDismiss: false },
  AMBUSH:  { color: '#f97316', label: 'Ambush',  glyph: '!', svgPath: `<path d="M19 11 L19 23" stroke="white" stroke-width="4.5" stroke-linecap="round"/><circle cx="19" cy="28.5" r="2.8" fill="white"/>`,                                          alertTone: 'error', autoDismiss: false },
  LINK_UP: { color: '#3b82f6', label: 'Link Up', glyph: '↑', svgPath: `<path d="M10 19 L19 10 L28 19 M19 10 L19 27" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`, alertTone: 'info',  autoDismiss: true  },
};

export const EVENT_STATUS_OPACITY = { ACTIVE: 1, ACKNOWLEDGED: 0.7, RESOLVED: 0.4 };
export const STATUS_BADGE_CLASS = {
  ACTIVE:       'bg-red-500/20 text-red-400',
  ACKNOWLEDGED: 'bg-amber-500/20 text-amber-400',
  RESOLVED:     'bg-gray-500/20 text-gray-400',
};

export const buildEventMarkerSvg = ({ eventType, status }) => {
  const cfg = EVENT_TYPE_CONFIG[eventType] || { color: '#6b7280', svgPath: '' };
  return `<svg width="28" height="36" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${EVENT_STATUS_OPACITY[status] ?? 0.4}"><defs><filter id="evs" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.6)"/></filter></defs><path d="M19 2 C9 2 1 10 1 20 C1 30 19 46 19 46 C19 46 37 30 37 20 C37 10 29 2 19 2Z" fill="${cfg.color}" filter="url(#evs)"/><circle cx="19" cy="19" r="13" fill="rgba(0,0,0,0.25)"/>${cfg.svgPath}</svg>`;
};

// ── Leaflet Icon factories ────────────────────────────────────────────────────
export const createUserMarkerIcon = ({ color, isOnline = false, operationalRole = '', className = '' }) =>
  new Icon({ iconUrl: svgToDataUrl(buildUserPinSvg({ color, isOnline, operationalRole })), iconSize: [26, 34], iconAnchor: [13, 33], popupAnchor: [0, -34], className });

export const createSelfMarkerIcon = ({ color, className = '' }) =>
  new Icon({ iconUrl: svgToDataUrl(buildSelfDotSvg({ color })), iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -20], className });

export const createAoMarkerIcon = ({ color, icon, className = '', variant = 'pin' }) => {
  const safeColor = color || DEFAULT_AO_COLOR;
  const trimmedIcon = `${icon || DEFAULT_AO_ICON}`.trim();
  const iconUrl = trimmedIcon && isImageUrl(trimmedIcon) ? trimmedIcon : '';
  return new Icon({
    iconUrl: svgToDataUrl(buildAoPinSvg({ color: safeColor, icon: iconUrl ? '' : trimmedIcon, iconUrl })),
    iconSize: [32, 32],
    iconAnchor: variant === 'dot' ? [16, 16] : [16, 32],
    popupAnchor: variant === 'dot' ? [0, -16] : [0, -32],
    className,
  });
};

export const createEventMarkerIcon = ({ eventType, status }) =>
  new Icon({
    iconUrl:     svgToDataUrl(buildEventMarkerSvg({ eventType, status })),
    iconSize:    [28, 36], iconAnchor: [14, 35], popupAnchor: [0, -36],
    className:   status === 'ACTIVE' ? 'event-marker-active' : '',
  });

// Module-level event icon cache (shared between Dashboard + MobileFieldMap)
const _eventIconCache = new Map();
export const getEventIconCached = (eventType, status) => {
  const key = `${eventType}:${status}`;
  if (!_eventIconCache.has(key)) _eventIconCache.set(key, createEventMarkerIcon({ eventType, status }));
  return _eventIconCache.get(key);
};

// ── Cluster marker (2+ users at same location) ────────────────────────────────
export const buildClusterMarkerSvg = ({ color, count }) => {
  const c = sanitizeColor(color);
  const label = count > 99 ? '99+' : String(count);
  const fontSize = count > 9 ? 11 : 14;
  return `<svg width="42" height="42" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><filter id="cls" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.65)"/></filter></defs><circle cx="28" cy="28" r="27" fill="${c}" fill-opacity="0.18" filter="url(#cls)"/><circle cx="28" cy="28" r="20" fill="${c}"/><circle cx="28" cy="28" r="20" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2.5"/><circle cx="28" cy="28" r="26.5" fill="none" stroke="${c}" stroke-width="1.5" stroke-opacity="0.45"/><text x="28" y="28" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="700" fill="white" font-family="'Segoe UI',Arial,sans-serif" letter-spacing="0.5">${label}</text></svg>`;
};

export const createClusterMarkerIcon = ({ color, count, className = '' }) =>
  new Icon({ iconUrl: svgToDataUrl(buildClusterMarkerSvg({ color, count })), iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -24], className });

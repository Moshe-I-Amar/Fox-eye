import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, FeatureGroup, Polygon } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { Icon } from 'leaflet';
import { userService } from '../services/usersApi';
import { aoService } from '../services/aoApi';
import { eventApi } from '../services/eventApi';
import socketService from '../services/socketService';
import { authService } from '../services/authApi';
import { hierarchyService } from '../services/hierarchyApi';
import { isValidCoords, safeGetCoords } from '../utils/location';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import AlertBanner from '../components/ui/AlertBanner';
import Badge from '../components/ui/Badge';
import Navbar from '../components/layout/Navbar';
import NotificationPrompt from '../components/ui/NotificationPrompt';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_SEARCH_RADIUS_KM,
  DEFAULT_AO_COLOR,
  DEFAULT_AO_ICON,
  AO_ICON_MAX_LENGTH,
  AO_NAME_MIN,
  AO_NAME_MAX,
  VIEWPORT_DEBOUNCE_MS,
} from '../config/constants';
import useAOs from '../hooks/useAOs';
import useViolations from '../hooks/useViolations';
import useFieldEvents from '../hooks/useFieldEvents';

const MapController = ({ center, triggerFly, userLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (!isValidCoords(center)) {
      return;
    }
    map.setView(center, map.getZoom());
  }, [center, map]);

  // Fly to the user's own position when the locate-me button is pressed.
  // Depends only on triggerFly so panning the map doesn't re-trigger the fly.
  useEffect(() => {
    if (!isValidCoords(userLocation)) return;
    map.flyTo(userLocation, map.getZoom(), { animate: true, duration: 0.8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFly]);

  return null;
};

const MapViewportSubscriber = ({ onViewportChange, debounceMs = VIEWPORT_DEBOUNCE_MS }) => {
  const map = useMap();
  const debounceRef = useRef(null);

  const emitViewport = useCallback(() => {
    if (!onViewportChange) {
      return;
    }
    const bounds = map.getBounds();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    onViewportChange({
      minLat: southWest.lat,
      minLng: southWest.lng,
      maxLat: northEast.lat,
      maxLng: northEast.lng,
      zoom: map.getZoom()
    });
  }, [map, onViewportChange]);

  const scheduleViewport = useCallback(() => {
    if (!onViewportChange) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      emitViewport();
    }, debounceMs);
  }, [debounceMs, emitViewport, onViewportChange]);

  useMapEvents({
    move: scheduleViewport,
    zoom: scheduleViewport
  });

  useEffect(() => {
    scheduleViewport();
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [scheduleViewport]);

  return null;
};


const escapeXml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isImageUrl = (value = '') =>
  /^(data:image\/(?!svg\+xml)[a-z0-9+.-]+;|https?:\/\/|\/[^/]|blob:)/i.test(value.trim());

const sanitizeColor = (value = '') => {
  const trimmed = (value || '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+)?\s*\)$/.test(trimmed)) return trimmed;
  return DEFAULT_AO_COLOR;
};
const isValidIconValue = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (isImageUrl(trimmed)) return true;
  return trimmed.length <= AO_ICON_MAX_LENGTH;
};

const svgToDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

/**
 * Role-specific icon markup drawn inside the pin badge (viewBox 0 0 38 48).
 * Badge area: circle cx=19 cy=19 r=13. All icons use white fill/stroke.
 */
const ROLE_ICON = {
  // HQ — 5-point star
  HQ: `<polygon points="19,9 21.2,15.9 27.6,16.2 22.6,20.2 24.3,26.3 19,22.8 13.7,26.3 15.4,20.2 10.4,16.2 16.8,15.9" fill="white" fill-opacity="0.95"/>`,

  // UNIT_COMMANDER — 3 horizontal bars (colonel rank)
  UNIT_COMMANDER: `
    <rect x="10" y="12" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/>
    <rect x="10" y="17.5" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/>
    <rect x="10" y="23" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/>`,

  // COMPANY_COMMANDER — 2 horizontal bars (captain rank)
  COMPANY_COMMANDER: `
    <rect x="10" y="14" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/>
    <rect x="10" y="21" width="18" height="2.5" rx="1.25" fill="white" fill-opacity="0.95"/>`,

  // TEAM_LEADER / TEAM_COMMANDER — chevron up
  TEAM_LEADER: `<path d="M8 25 L19 11 L30 25" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.95"/>`,
  TEAM_COMMANDER: `<path d="M8 25 L19 11 L30 25" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.95"/>`,

  // SQUAD_COMMANDER — diamond
  SQUAD_COMMANDER: `<polygon points="19,9 29,19 19,29 9,19" fill="white" fill-opacity="0.95"/>`,
};

/** Friendly display label for a role string */
const ROLE_LABEL = {
  HQ: 'HQ',
  UNIT_COMMANDER: 'Unit Commander',
  COMPANY_COMMANDER: 'Company Commander',
  TEAM_LEADER: 'Team Leader',
  TEAM_COMMANDER: 'Team Commander',
  SQUAD_COMMANDER: 'Squad Commander',
};

/**
 * User marker — teardrop pin with role-specific icon.
 * Colored by company AO identity. Online dot at top-right corner.
 */
const buildUserPinSvg = ({ color, isOnline, operationalRole }) => {
  const c = sanitizeColor(color);
  const roleMarkup = ROLE_ICON[operationalRole] ?? `
    <circle cx="19" cy="14" r="5.5" fill="white" fill-opacity="0.95"/>
    <path d="M7 29 C7 21 31 21 31 29" fill="white" fill-opacity="0.95"/>`;

  const statusDot = isOnline
    ? `<circle cx="29" cy="8" r="4.5" fill="#34d399" stroke="${c}" stroke-width="2"/>`
    : `<circle cx="29" cy="8" r="4.5" fill="#4b5563" stroke="${c}" stroke-width="2"/>`;

  return `<svg width="26" height="34" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="ps" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>
  <path d="M19 2 C9 2 1 10 1 20 C1 30 19 46 19 46 C19 46 37 30 37 20 C37 10 29 2 19 2Z"
        fill="${c}" filter="url(#ps)"/>
  <circle cx="19" cy="19" r="13" fill="rgba(0,0,0,0.28)"/>
  ${roleMarkup}
  ${statusDot}
</svg>`;
};

/**
 * Self marker — concentric gold rings with person icon.
 * Visually distinct from other-user markers.
 */
const buildSelfDotSvg = ({ color }) => {
  const c = sanitizeColor(color);
  return `<svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="23" fill="${c}" fill-opacity="0.12"/>
  <circle cx="24" cy="24" r="17" fill="${c}" fill-opacity="0.25"/>
  <circle cx="24" cy="24" r="12" fill="${c}"/>
  <circle cx="24" cy="24" r="12" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
  <circle cx="24" cy="19" r="4" fill="#0a0a0a"/>
  <path d="M13 33 C13 25 35 25 35 33" fill="#0a0a0a"/>
</svg>`;
};

/**
 * AO label marker — small pin/dot showing company icon on the map.
 * Unchanged — keeps text/emoji icon support for AO overlays.
 */
const buildAoPinSvg = ({ color, icon, iconUrl }) => {
  const safeColor = sanitizeColor(color);
  const iconMarkup = iconUrl
    ? `<image href="${iconUrl}" x="7" y="5" width="10" height="10"/>`
    : icon
      ? `<text x="12" y="11" text-anchor="middle" dominant-baseline="middle" font-size="6" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif">${escapeXml(icon)}</text>`
      : `<circle cx="12" cy="10" r="2.5" fill="#ffffff"/>`;
  return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C8 13 2 20 2 20C2 20 12 20 20 20C20 20 16 13 12 2Z" fill="${safeColor}"/>
  <circle cx="12" cy="10" r="4.5" fill="rgba(0,0,0,0.35)"/>
  ${iconMarkup}
</svg>`;
};

const createUserMarkerIcon = ({ color, isOnline = false, operationalRole = '', className = '' }) =>
  new Icon({
    iconUrl: svgToDataUrl(buildUserPinSvg({ color, isOnline, operationalRole })),
    iconSize: [26, 34],
    iconAnchor: [13, 33],
    popupAnchor: [0, -34],
    className,
  });

const createSelfMarkerIcon = ({ color, className = '' }) =>
  new Icon({
    iconUrl: svgToDataUrl(buildSelfDotSvg({ color })),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
    className,
  });

const createAoMarkerIcon = ({ color, icon, className = '', variant = 'pin' }) => {
  const safeColor = color || DEFAULT_AO_COLOR;
  const trimmedIcon = `${icon || DEFAULT_AO_ICON}`.trim();
  const iconUrl = trimmedIcon && isImageUrl(trimmedIcon) ? trimmedIcon : '';
  const iconText = iconUrl ? '' : trimmedIcon;
  return new Icon({
    iconUrl: svgToDataUrl(buildAoPinSvg({ color: safeColor, icon: iconText, iconUrl })),
    iconSize: [32, 32],
    iconAnchor: variant === 'dot' ? [16, 16] : [16, 32],
    popupAnchor: variant === 'dot' ? [0, -16] : [0, -32],
    className,
  });
};

/** Color, display label, glyph, SVG path, alert tone and auto-dismiss per event type */
const EVENT_TYPE_CONFIG = {
  INJURED: { color: '#ef4444', label: 'Injured', glyph: '✚', svgPath: `<path d="M19 11 L19 27 M11 19 L27 19" stroke="white" stroke-width="5" stroke-linecap="round"/>`,                                                                                          alertTone: 'error', autoDismiss: false },
  AMBUSH:  { color: '#f97316', label: 'Ambush',  glyph: '!', svgPath: `<path d="M19 11 L19 23" stroke="white" stroke-width="4.5" stroke-linecap="round"/><circle cx="19" cy="28.5" r="2.8" fill="white"/>`,                                                          alertTone: 'error', autoDismiss: false },
  LINK_UP: { color: '#3b82f6', label: 'Link Up', glyph: '↑', svgPath: `<path d="M10 19 L19 10 L28 19 M19 10 L19 27" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`, alertTone: 'info',  autoDismiss: true  },
};

const EVENT_STATUS_OPACITY = { ACTIVE: 1, ACKNOWLEDGED: 0.7, RESOLVED: 0.4 };

const STATUS_BADGE_CLASS = {
  ACTIVE:       'bg-red-500/20 text-red-400',
  ACKNOWLEDGED: 'bg-amber-500/20 text-amber-400',
  RESOLVED:     'bg-gray-500/20 text-gray-400',
};

const buildEventMarkerSvg = ({ eventType, status }) => {
  const cfg  = EVENT_TYPE_CONFIG[eventType] || { color: '#6b7280', svgPath: '' };
  return `<svg width="28" height="36" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${EVENT_STATUS_OPACITY[status] ?? 0.4}">
  <defs>
    <filter id="evs" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.6)"/>
    </filter>
  </defs>
  <path d="M19 2 C9 2 1 10 1 20 C1 30 19 46 19 46 C19 46 37 30 37 20 C37 10 29 2 19 2Z"
        fill="${cfg.color}" filter="url(#evs)"/>
  <circle cx="19" cy="19" r="13" fill="rgba(0,0,0,0.25)"/>
  ${cfg.svgPath}
</svg>`;
};

const createEventMarkerIcon = ({ eventType, status }) =>
  new Icon({
    iconUrl:     svgToDataUrl(buildEventMarkerSvg({ eventType, status })),
    iconSize:    [28, 36],
    iconAnchor:  [14, 35],
    popupAnchor: [0, -36],
    className:   status === 'ACTIVE' ? 'event-marker-active' : '',
  });

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

  const activeAos = aos.filter((ao) => ao?.active);
  const inactiveAos = aos.filter((ao) => !ao?.active);

  for (const ao of activeAos) {
    if (isPointInPolygon(point, ao?.polygon)) {
      return ao;
    }
  }

  for (const ao of inactiveAos) {
    if (isPointInPolygon(point, ao?.polygon)) {
      return ao;
    }
  }

  return null;
};

const toGeoPolygon = (latLngs) => {
  if (!Array.isArray(latLngs) || latLngs.length === 0) {
    return null;
  }

  const ring = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
  if (!Array.isArray(ring) || ring.length === 0) {
    return null;
  }

  const coordinates = ring.map((point) => [point.lng, point.lat]);
  if (coordinates.length > 2) {
    const [firstLng, firstLat] = coordinates[0];
    const [lastLng, lastLat] = coordinates[coordinates.length - 1];
    if (firstLng !== lastLng || firstLat !== lastLat) {
      coordinates.push([firstLng, firstLat]);
    }
  }

  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
};

const toLatLngs = (polygon) => {
  if (!polygon?.coordinates?.[0]) {
    return [];
  }

  return polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
};

const MapComponent = ({
  center,
  users,
  userLocation,
  onUserClick,
  liveUpdateIds,
  onViewportChange,
  aos = [],
  onAOCreate,
  onAOEdit,
  onAODelete,
  onAOSelect,
  featureGroupRef,
  canManageAOs = false,
  getCompanyIdentity,
  fieldEvents = [],
  onEventClick,
}) => {
  const [flyTrigger, setFlyTrigger] = useState(0);

  const handleCenterOnMe = useCallback(() => {
    if (isValidCoords(userLocation)) setFlyTrigger((n) => n + 1);
  }, [userLocation]);

  const bindAoLayer = (aoId) => (layer) => {
    if (layer) {
      layer.options.aoId = aoId;
    }
  };

  const iconCacheRef = useRef(new Map());

  const getCachedIcon = useCallback((key, create) => {
    const cache = iconCacheRef.current;
    if (cache.has(key)) {
      return cache.get(key);
    }
    const icon = create();
    cache.set(key, icon);
    return icon;
  }, []);

  const getAoForPoint = useCallback(
    (point) => findAoForPoint(point, aos),
    [aos]
  );

  const getMarkerIcon = useCallback(
    ({ point, className = '', variant = 'pin', isOnline = false, operationalRole = '' }) => {
      const ao = getAoForPoint(point);
      const companyIdentity = ao && getCompanyIdentity ? getCompanyIdentity(ao) : null;
      const color = companyIdentity?.color || DEFAULT_AO_COLOR;

      if (variant === 'dot') {
        const cacheKey = `self:${className}:${color}`;
        return getCachedIcon(cacheKey, () => createSelfMarkerIcon({ color, className }));
      }

      // 'pin' → role-specific person marker
      const cacheKey = `user:${className}:${color}:${isOnline}:${operationalRole}`;
      return getCachedIcon(cacheKey, () =>
        createUserMarkerIcon({ color, isOnline, operationalRole, className })
      );
    },
    [getAoForPoint, getCachedIcon]
  );

  const aoStrokeStyles = useMemo(
    () =>
      new Map(
        aos.map((ao) => {
          const identity = getCompanyIdentity ? getCompanyIdentity(ao) : null;
          return [
            ao._id,
            {
              color: identity?.color || DEFAULT_AO_COLOR,
              fillColor: identity?.color || DEFAULT_AO_COLOR
            }
          ];
        })
      ),
    [aos, getCompanyIdentity]
  );

  return (
    <div className="relative h-full w-full">
      {/* ── Locate-me FAB ──────────────────────────────────────────────────── */}
      <button
        onClick={handleCenterOnMe}
        disabled={!isValidCoords(userLocation)}
        aria-label="Center map on my location"
        title="Center on me"
        className="absolute bottom-4 right-4 z-[900]
          w-11 h-11 rounded-full flex items-center justify-center
          bg-charcoal/90 border border-gold/40 text-gold text-lg
          shadow-gold-glow backdrop-blur-sm transition-all duration-150
          hover:bg-slate-dark active:scale-95
          disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ◎
      </button>

    <MapContainer
      center={center}
      zoom={DEFAULT_MAP_ZOOM}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapController center={center} triggerFly={flyTrigger} userLocation={userLocation} />
      <MapViewportSubscriber onViewportChange={onViewportChange} />

      <FeatureGroup ref={featureGroupRef}>
        {canManageAOs && (
          <EditControl
            position="topright"
            onCreated={onAOCreate}
            onEdited={onAOEdit}
            onDeleted={onAODelete}
            draw={{
              polygon: {
                allowIntersection: false,
                showArea: false,
                shapeOptions: {
                  color: DEFAULT_AO_COLOR,
                  weight: 2,
                  fillOpacity: 0.2
                }
              },
              polyline: false,
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false
            }}
            edit={{
              edit: {
                selectedPathOptions: {
                  color: DEFAULT_AO_COLOR,
                  fillOpacity: 0.25
                }
              },
              remove: true
            }}
          />
        )}

        {aos.map((ao) => (
          <Polygon
            key={ao._id}
            positions={toLatLngs(ao.polygon)}
            pathOptions={{
              color: aoStrokeStyles.get(ao._id)?.color || DEFAULT_AO_COLOR,
              fillColor: aoStrokeStyles.get(ao._id)?.fillColor || DEFAULT_AO_COLOR,
              fillOpacity: ao.active ? 0.2 : 0.06,
              weight: ao.active ? 2 : 1,
              dashArray: (getCompanyIdentity && getCompanyIdentity(ao)?.pattern) || (ao.active ? null : '5,6')
            }}
            ref={bindAoLayer(ao._id)}
            eventHandlers={{
              click: () => onAOSelect?.(ao)
            }}
          >
            <Popup>
              <div className="text-jet">
                <p className="font-semibold">
                  {ao?.style?.icon && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-jet text-[10px] text-white mr-2">
                      {isImageUrl(ao.style.icon) ? (
                        <img src={ao.style.icon} alt="" className="h-3 w-3" />
                      ) : (
                        ao.style.icon
                      )}
                    </span>
                  )}
                  {ao.name}
                </p>
                <p className="text-xs text-gray-600">
                  {ao.active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </Popup>
          </Polygon>
        ))}
      </FeatureGroup>
      
      {/* Self location marker */}
      {isValidCoords(userLocation) && (
        <Marker
          position={userLocation}
          icon={getMarkerIcon({
            point: [userLocation[1], userLocation[0]],
            variant: 'dot',
          })}
        >
          <Popup className="marker-popup-dark">
            <div className="map-popup">
              <div className="map-popup-header">
                <span className="map-popup-avatar self">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                </span>
                <div>
                  <p className="map-popup-name">You</p>
                  <p className="map-popup-sub">{userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}</p>
                </div>
              </div>
              <span className="map-popup-badge online">● LIVE</span>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Other users' markers */}
      {users
        .map((user) => ({ user, coords: safeGetCoords(user) }))
        .filter(({ coords }) => isValidCoords(coords))
        .map(({ user, coords }) => (
          <Marker
            key={user._id}
            position={[coords[1], coords[0]]}
            icon={getMarkerIcon({
              point: coords,
              className: liveUpdateIds.has(user._id) ? 'marker-live-update' : '',
              variant: 'pin',
              isOnline: Boolean(user.isOnline || user.online),
              operationalRole: user.operationalRole || '',
            })}
            eventHandlers={{ click: () => onUserClick(user) }}
          >
            <Popup className="marker-popup-dark">
              <div className="map-popup">
                <div className="map-popup-header">
                  <span className="map-popup-avatar">
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                  <div>
                    <p className="map-popup-name">{user.name}</p>
                    {user.operationalRole && (
                      <p className="map-popup-role">
                        {ROLE_LABEL[user.operationalRole] || user.operationalRole}
                      </p>
                    )}
                    <p className="map-popup-sub">{user.email}</p>
                  </div>
                </div>
                <div className="map-popup-footer">
                  <span className={`map-popup-badge ${(user.isOnline || user.online) ? 'online' : 'offline'}`}>
                    {(user.isOnline || user.online) ? '● ONLINE' : '○ OFFLINE'}
                  </span>
                  {user.distance && (
                    <span className="map-popup-dist">{user.distance} km away</span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Field event markers — coords pre-validated by visibleEvents memo */}
      {fieldEvents.map((ev) => {
          const [lng, lat] = ev.coordinates.coordinates;
          const cfg = EVENT_TYPE_CONFIG[ev.eventType] || { color: '#6b7280', label: ev.eventType, glyph: '?' };
          return (
            <Marker
              key={ev._id}
              position={[lat, lng]}
              icon={getCachedIcon(`event:${ev.eventType}:${ev.status}`, () => createEventMarkerIcon({ eventType: ev.eventType, status: ev.status }))}
              eventHandlers={{ click: () => onEventClick?.(ev) }}
              zIndexOffset={ev.status === 'ACTIVE' ? 500 : 0}
            >
              <Popup className="marker-popup-dark">
                <div className="map-popup">
                  <div className="map-popup-header">
                    <span
                      className="map-popup-avatar"
                      style={{ backgroundColor: cfg.color, fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      {cfg.glyph}
                    </span>
                    <div>
                      <p className="map-popup-name">{cfg.label}</p>
                      <p className="map-popup-sub">
                        {new Date(ev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="map-popup-footer">
                    <span className={`map-popup-badge ${ev.status === 'ACTIVE' ? 'online' : 'offline'}`}>
                      {ev.status}
                    </span>
                    <span className="map-popup-dist">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
    </div>
  );
};

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLocation, setUserLocation] = useState(DEFAULT_MAP_CENTER);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [radius, setRadius] = useState(DEFAULT_SEARCH_RADIUS_KM);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('offline');
  const [realtimeNotice, setRealtimeNotice] = useState('');
  const [realtimeNoticeTone, setRealtimeNoticeTone] = useState('warning');
  const [liveUpdateIds, setLiveUpdateIds] = useState(new Set());
  const liveUpdateTimers = useRef(new Map());
  const nearbyFetchTimerRef = useRef(null);
  const realtimeEnabledRef = useRef(realtimeEnabled);
  const hasCenteredMapRef = useRef(false);
  const lastLocationSentRef = useRef({ time: 0, coords: null });
  const socketInitializedRef = useRef(false);
  const [viewportBounds, setViewportBounds] = useState(null);
  const { aos, setAos, loading: aoLoading, error: aoError, setError: setAoError, refetch: fetchAOs } = useAOs();
  const [aoDraft, setAoDraft] = useState(null);
  const [aoModalMode, setAoModalMode] = useState('create');
  const [aoForm, setAoForm] = useState({ name: '', color: DEFAULT_AO_COLOR, icon: '', pattern: '', companyId: '' });
  const [aoIconError, setAoIconError] = useState('');
  const [aoNameError, setAoNameError] = useState('');
  const [selectedAO, setSelectedAO] = useState(null);
  const [aoSaving, setAoSaving] = useState(false);
  const [violationFilters, setViolationFilters] = useState({
    severity: 'all',
    companyId: '',
    start: '',
    end: ''
  });
  const [hierarchyMap, setHierarchyMap] = useState({
    units: {},
    companies: {},
    teams: {},
    squads: {}
  });
  const [companyOptions, setCompanyOptions] = useState([]);
  const featureGroupRef = useRef(null);
  // Use AuthContext as the single source of truth for the current user.
  // Avoids stale localStorage reads when the session has silently expired
  // (e.g., old SW serving a cached getMe() 200 after the JWT actually expired).
  const { user: currentUser } = useAuth();
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const currentUserId = currentUser?.id || currentUser?._id;
  const canManageAOs = currentUser?.role === 'admin' || currentUser?.operationalRole === 'COMPANY_COMMANDER';
  const canViewViolations =
    currentUser?.role === 'admin' ||
    ['HQ', 'UNIT_COMMANDER'].includes(currentUser?.operationalRole);
  const { violations, loading: violationLoading, error: violationError } = useViolations(canViewViolations, violationFilters);
  const { events: fieldEvents, loading: fieldEventsLoading } = useFieldEvents(50);
  const [showResolvedEvents, setShowResolvedEvents] = useState(false);
  const [eventAlert, setEventAlert] = useState(null);
  const [respondingIds, setRespondingIds] = useState(new Set());
  useEffect(() => {
    if (!eventAlert?.autoDismiss) return;
    const t = setTimeout(() => setEventAlert(null), 8000);
    return () => clearTimeout(t);
  }, [eventAlert]);

  const { visibleEvents, activeEventCount } = useMemo(() => {
    let active = 0;
    const visible = [];
    for (const ev of fieldEvents) {
      if (ev.status === 'ACTIVE') active++;
      const c = ev.coordinates?.coordinates;
      if (!Array.isArray(c) || c.length !== 2) continue;
      if (!showResolvedEvents && ev.status === 'RESOLVED') continue;
      visible.push(ev);
    }
    return { visibleEvents: visible, activeEventCount: active };
  }, [fieldEvents, showResolvedEvents]);
  const navigate = useNavigate();

  // Initialize socket connection
  useEffect(() => {
    const handleConnect = () => {
      setRealtimeEnabled(true);
      setRealtimeStatus('connected');
      setRealtimeNotice('');
    };

    const handleDisconnect = (payload = {}) => {
      const reason = payload?.reason;
      if (reason === 'io client disconnect' || reason === 'auth_error') {
        setRealtimeStatus('offline');
        return;
      }
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates disconnected. Attempting to reconnect...');
    };

    const handleReconnect = () => {
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Reconnecting to live updates...');
    };

    const handleConnectError = () => {
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates disconnected. Attempting to reconnect...');
    };

    const handleReconnectFailed = () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates are unavailable. Using HTTP fallback.');
    };

    const handleAuthError = async () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('error');
      setRealtimeNotice('Session expired. Redirecting to login...');
      await authService.logout();
      navigate('/login', {
        replace: true,
        state: {
          reason: 'session-expired',
          message: 'Your session expired. Please sign in again.'
        }
      });
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('reconnecting', handleReconnect);
    socketService.on('connect_error', handleConnectError);
    socketService.on('reconnect_failed', handleReconnectFailed);
    socketService.on('auth_error', handleAuthError);

    const initSocket = async () => {
      try {
          await socketService.connect(null);
          setRealtimeEnabled(true);
          setRealtimeStatus('connected');
          socketInitializedRef.current = true;

          // Subscribe to presence updates
          socketService.subscribeToPresence();

          console.log('Socket connected and authenticated');
        } catch (error) {
          socketInitializedRef.current = true;
          const message = `${error?.message || ''}`.toLowerCase();
          if (message.includes('authentication error') || message.includes('token expired') || message.includes('invalid token')) {
            return;
          }
          setRealtimeEnabled(false);
          setRealtimeStatus('offline');
        }
    };

    initSocket();

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('reconnecting', handleReconnect);
      socketService.off('connect_error', handleConnectError);
      socketService.off('reconnect_failed', handleReconnectFailed);
      socketService.off('auth_error', handleAuthError);
      socketService.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    realtimeEnabledRef.current = realtimeEnabled;
  }, [realtimeEnabled]);

  useEffect(() => {
    return () => {
      liveUpdateTimers.current.forEach((timer) => clearTimeout(timer));
      liveUpdateTimers.current.clear();
      if (nearbyFetchTimerRef.current) {
        clearTimeout(nearbyFetchTimerRef.current);
      }
    };
  }, []);

  const markLiveUpdate = (userId) => {
    setLiveUpdateIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });

    if (liveUpdateTimers.current.has(userId)) {
      clearTimeout(liveUpdateTimers.current.get(userId));
    }

    const timeoutId = setTimeout(() => {
      setLiveUpdateIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      liveUpdateTimers.current.delete(userId);
    }, 1600);

    liveUpdateTimers.current.set(userId, timeoutId);
  };

  // Setup socket event listeners
  useEffect(() => {
    if (!realtimeEnabled) return;

    const applyPresenceUpdate = (payload) => {
      setUsers(prevUsers => prevUsers.map(user => (
        user._id === payload.userId
          ? { ...user, isOnline: payload.online, lastSeen: payload.lastSeen }
          : user
      )));
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (payload.online) {
          next.add(payload.userId);
        } else {
          next.delete(payload.userId);
        }
        return next;
      });
    };

    const handleLocationUpdate = (data) => {

      if (!isValidCoords(data?.coordinates)) {
        return;
      }

      const [longitude, latitude] = data.coordinates;
      const distanceCenter = isValidCoords(userLocation) ? userLocation : mapCenter;

      if (currentUserId && data.userId === currentUserId) {
        setUserLocation([latitude, longitude]);
      }

      const nextLocation = {
        type: 'Point',
        coordinates: [longitude, latitude]
      };
      const updateTimestamp = data.timestamp || new Date().toISOString();

      // Update users list if the updated user is in our current view
      setUsers(prevUsers => {
        const userIndex = prevUsers.findIndex(u => u._id === data.userId);
        if (userIndex !== -1) {
          const updatedUsers = [...prevUsers];
          updatedUsers[userIndex] = {
            ...updatedUsers[userIndex],
            location: nextLocation,
            distance: calculateDistance(
              distanceCenter,
              [latitude, longitude]
            ),
            lastUpdateAt: updateTimestamp
          };
          return updatedUsers;
        }
        return prevUsers;
      });

      setSelectedUser(prev => (
        prev && prev._id === data.userId
          ? {
              ...prev,
              location: nextLocation,
              distance: calculateDistance(distanceCenter, [latitude, longitude]),
              lastUpdateAt: updateTimestamp
            }
          : prev
      ));

      markLiveUpdate(data.userId);
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    };

    const handlePresenceUpdate = (data) => {
      applyPresenceUpdate(data);
      if (data?.userId) {
        setSelectedUser(prev => (
          prev && prev._id === data.userId
            ? { ...prev, isOnline: data.online, lastSeen: data.lastSeen }
            : prev
        ));
      }
    };

    const handleSocketError = (error) => {
    };

    const handleFieldEventNew = ({ event } = {}) => {
      if (!event || event.status !== 'ACTIVE') return;
      const cfg = EVENT_TYPE_CONFIG[event.eventType];
      if (!cfg) return;
      const sender = event.senderName || 'Unknown';
      setEventAlert({
        id: event._id,
        message: `${cfg.glyph} ${cfg.label.toUpperCase()} — reported by ${sender}`,
        tone: cfg.alertTone,
        autoDismiss: cfg.autoDismiss,
      });
    };

    socketService.on('location:update', handleLocationUpdate);
    socketService.on('presence:update', handlePresenceUpdate);
    socketService.on('error', handleSocketError);
    socketService.on('field:event:new', handleFieldEventNew);

    return () => {
      socketService.off('location:update', handleLocationUpdate);
      socketService.off('presence:update', handlePresenceUpdate);
      socketService.off('error', handleSocketError);
      socketService.off('field:event:new', handleFieldEventNew);
    };
  }, [realtimeEnabled, mapCenter, radius, currentUserId, userLocation]);

  useEffect(() => {
    if (!realtimeEnabled || !viewportBounds) {
      return;
    }
    if (!socketService.isSocketConnected()) {
      return;
    }
    socketService.subscribeToViewport(viewportBounds);
  }, [realtimeEnabled, viewportBounds]);

  const getViewportCenter = useCallback(() => {
    if (!viewportBounds) {
      return null;
    }
    const center = [
      (viewportBounds.minLat + viewportBounds.maxLat) / 2,
      (viewportBounds.minLng + viewportBounds.maxLng) / 2
    ];
    return isValidCoords(center) ? center : null;
  }, [viewportBounds]);

  const getNearbyCenter = useCallback(() => {
    if (isValidCoords(userLocation)) {
      return userLocation;
    }
    const viewportCenter = getViewportCenter();
    if (viewportCenter) {
      return viewportCenter;
    }
    if (isValidCoords(mapCenter)) {
      return mapCenter;
    }
    return null;
  }, [getViewportCenter, mapCenter, userLocation]);

  const fetchNearbyUsers = useCallback(
    async (centerOverride) => {
      const center = centerOverride || getNearbyCenter();
      if (!center) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Use socket for real-time data if available, otherwise fall back to HTTP
        if (realtimeEnabled && socketService.isSocketConnected()) {
          socketService.requestLocation(center, radius, true);
        } else if (socketInitializedRef.current) {
          const response = await userService.getUsersNearby(center[0], center[1], radius);
          setUsers(response.users.map(user => ({
            ...user,
            lastUpdateAt: user.lastUpdateAt || user.lastSeen || user.updatedAt
          })));
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    },
    [getNearbyCenter, radius, realtimeEnabled]
  );

  const scheduleNearbyFetch = useCallback(
    (centerOverride) => {
      if (nearbyFetchTimerRef.current) {
        clearTimeout(nearbyFetchTimerRef.current);
      }
      nearbyFetchTimerRef.current = setTimeout(() => {
        fetchNearbyUsers(centerOverride);
      }, 450);
    },
    [fetchNearbyUsers]
  );

  useEffect(() => {
    const center = getNearbyCenter();
    if (!center) {
      return;
    }
    scheduleNearbyFetch(center);
  }, [getNearbyCenter, scheduleNearbyFetch, radius, realtimeEnabled]);

  // Utility functions
  const calculateDistance = (center, userCoords) => {
    const [lat1, lon1] = center;
    const [lat2, lon2] = userCoords;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c * 100) / 100; // Distance in km with 2 decimal places
  };

  // AOs are fetched by the useAOs hook on mount
  useEffect(() => { fetchAOs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let isActive = true;
    const loadHierarchy = async () => {
      try {
        const data = await hierarchyService.getTree();
        if (!isActive) return;
        const units = {};
        const companies = {};
        const teams = {};
        const squads = {};

        (data.units || []).forEach((unit) => { units[unit._id] = unit.name; });
        (data.companies || []).forEach((company) => {
          companies[company._id] = {
            name: company.name,
            color: company.color,
            pattern: company.pattern,
            icon: company.icon
          };
        });
        (data.teams || []).forEach((team) => { teams[team._id] = team.name; });
        (data.squads || []).forEach((squad) => { squads[squad._id] = squad.name; });

        setHierarchyMap({ units, companies, teams, squads });
        setCompanyOptions(data.companies || []);
      } catch (error) {
      }
    };

    loadHierarchy();

    return () => {
      isActive = false;
    };
  }, []);

  // violations, violationLoading, violationError are managed by useViolations hook above

  const visibleCompanies = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return companyOptions;
    }
    if (currentUser?.companyId) {
      return companyOptions.filter((company) => company._id === currentUser.companyId);
    }
    return companyOptions;
  }, [companyOptions, currentUser?.companyId, currentUser?.role]);

  useEffect(() => {
    if (!aoForm.companyId && visibleCompanies.length) {
      setAoForm((prev) => ({ ...prev, companyId: visibleCompanies[0]._id }));
    }
  }, [aoForm.companyId, visibleCompanies]);

  useEffect(() => {
    if (!aoForm.companyId) {
      return;
    }
    const company = companyOptions.find((item) => item._id === aoForm.companyId);
    if (!company) {
      return;
    }
    setAoForm((prev) => {
      const nextColor = company.color || DEFAULT_AO_COLOR;
      const nextIcon = company.icon || '';
      const nextPattern = company.pattern || '';
      if (prev.color === nextColor && prev.icon === nextIcon && prev.pattern === nextPattern) {
        return prev;
      }
      return {
        ...prev,
        color: nextColor,
        icon: nextIcon,
        pattern: nextPattern
      };
    });
  }, [aoForm.companyId, companyOptions]);

  const clearDraftLayer = () => {
    if (featureGroupRef.current && aoDraft?.layer) {
      featureGroupRef.current.removeLayer(aoDraft.layer);
    }
  };

  // Keep a ref to visibleCompanies so handleAOCreate can read the latest value
  // without changing its own reference (which would re-trigger EditControl's effect).
  const visibleCompaniesRef = useRef(visibleCompanies);
  visibleCompaniesRef.current = visibleCompanies;

  // react-leaflet-draw v0.20 registers anonymous wrapper handlers for every
  // draw:* event and has a broken cleanup that never removes those wrappers.
  // Its useEffect re-fires whenever onCreated/onEdited/onDeleted change reference.
  // If these callbacks are plain `const` functions they change on every Dashboard
  // re-render, causing wrappers to accumulate. After N re-renders, a single
  // draw:deleted fires handleAODelete N times → 1 success + (N-1) × 404.
  // Fix: useCallback with stable/minimal deps so the effect fires only once.

  const handleAOCreate = useCallback((event) => {
    if (!event?.layer) return;

    const polygon = toGeoPolygon(event.layer.getLatLngs());
    if (!polygon) return;

    // Read latest user/companies via refs so deps stay empty (prevents
    // react-leaflet-draw from accumulating duplicate event handler wrappers).
    const user = currentUserRef.current;
    const firstCompanyId = visibleCompaniesRef.current[0]?._id || '';

    setAoDraft({ polygon, layer: event.layer });
    setAoForm({
      name: '',
      color: DEFAULT_AO_COLOR,
      icon: '',
      pattern: '',
      companyId: user?.companyId || firstCompanyId
    });
    setAoIconError('');
    setAoNameError('');
    setAoModalMode('create');
    setAoError('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAOEdit = useCallback(async (event) => {
    if (!event?.layers) return;

    const updates = [];
    event.layers.eachLayer((layer) => {
      const aoId = layer?.options?.aoId;
      const polygon = toGeoPolygon(layer.getLatLngs());
      if (aoId && polygon) updates.push({ aoId, polygon });
    });

    if (!updates.length) return;

    try {
      setAoSaving(true);
      await Promise.all(
        updates.map((update) => aoService.updateAO(update.aoId, { polygon: update.polygon }))
      );
      setAos((prev) =>
        prev.map((ao) => {
          const update = updates.find((item) => item.aoId === ao._id);
          return update ? { ...ao, polygon: update.polygon } : ao;
        })
      );
    } catch (error) {
      setAoError('Failed to update AO geometry. Please try again.');
    } finally {
      setAoSaving(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAODelete = useCallback(async (event) => {
    if (!event?.layers) return;

    const aoIdSet = new Set();
    event.layers.eachLayer((layer) => {
      const aoId = layer?.options?.aoId;
      if (aoId) aoIdSet.add(aoId);
    });
    const aoIds = [...aoIdSet];

    if (!aoIds.length) return;

    try {
      setAoSaving(true);
      const results = await Promise.allSettled(
        aoIds.map((aoId) => aoService.deleteAO(aoId).then(() => aoId))
      );
      const deletedIds = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

      if (deletedIds.length) {
        setAos((prev) => prev.filter((ao) => !deletedIds.includes(ao._id)));
        setSelectedAO((prev) => (prev && deletedIds.includes(prev._id) ? null : prev));
      }

      if (results.some((result) => result.status === 'rejected')) {
        setAoError('Failed to delete one or more overlays. Refresh to retry.');
        fetchAOs();
      }
    } catch (error) {
      setAoError('Failed to delete overlay. Please try again.');
      fetchAOs();
    } finally {
      setAoSaving(false);
    }
  }, [fetchAOs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAOSelect = (ao) => {
    if (!canManageAOs) {
      return;
    }
    setSelectedAO(ao);
    setAoForm({
      name: ao.name || '',
      color: ao.style?.color || DEFAULT_AO_COLOR,
      icon: ao.style?.icon || '',
      pattern: ao.style?.pattern || '',
      companyId: ao.companyId || currentUser?.companyId || ''
    });
    setAoIconError('');
    setAoNameError('');
    setAoModalMode('edit');
    setAoError('');
  };

  const handleAOCancel = () => {
    clearDraftLayer();
    setAoDraft(null);
    setSelectedAO(null);
    setAoForm({
      name: '',
      color: DEFAULT_AO_COLOR,
      icon: '',
      pattern: '',
      companyId: currentUser?.companyId || visibleCompanies[0]?._id || ''
    });
    setAoIconError('');
    setAoNameError('');
  };

  const handleAOSubmit = async () => {
    const trimmedName = aoForm.name.trim();
    if (trimmedName.length < AO_NAME_MIN || trimmedName.length > AO_NAME_MAX) {
      setAoError(`AO name must be between ${AO_NAME_MIN} and ${AO_NAME_MAX} characters.`);
      return;
    }
    const trimmedIcon = aoForm.icon.trim();
    if (!isValidIconValue(trimmedIcon)) {
      setAoError(`Icon must be an image URL/path or ${AO_ICON_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!aoForm.companyId) {
      setAoError('Owning company is required to save this AO.');
      return;
    }

    try {
      setAoSaving(true);
      setAoError('');

      if (aoModalMode === 'create') {
        if (!aoDraft?.polygon) {
          return;
        }

        const payload = {
          name: trimmedName,
          polygon: aoDraft.polygon,
          style: { color: aoForm.color, icon: trimmedIcon, pattern: aoForm.pattern || '' },
          companyId: aoForm.companyId
        };

        const response = await aoService.createAO(payload);
        const createdAO = response?.ao;
        if (createdAO) {
          // Upsert: the socket ao:created broadcast may arrive before this REST
          // response (persistent connection vs HTTP round-trip), so guard against
          // adding a duplicate if the socket already inserted it.
          setAos((prev) => {
            const exists = prev.some((ao) => ao._id === createdAO._id);
            return exists
              ? prev.map((ao) => ao._id === createdAO._id ? createdAO : ao)
              : [createdAO, ...prev];
          });
        }
        clearDraftLayer();
        setAoDraft(null);
      } else if (selectedAO) {
        const response = await aoService.updateAO(selectedAO._id, {
          name: trimmedName,
          style: { color: aoForm.color, icon: trimmedIcon, pattern: aoForm.pattern || '' },
          companyId: aoForm.companyId
        });
        const updatedAO = response?.ao;
        if (updatedAO) {
          setAos((prev) => prev.map((ao) => (ao._id === updatedAO._id ? updatedAO : ao)));
        } else {
          setAos((prev) =>
            prev.map((ao) =>
              ao._id === selectedAO._id
                ? {
                    ...ao,
                    name: trimmedName,
                    style: { ...ao.style, color: aoForm.color, icon: trimmedIcon || null }
                  }
                : ao
            )
          );
        }
        setSelectedAO(null);
      }
    } catch (error) {
      setAoError('Failed to save AO. Please try again.');
    } finally {
      setAoSaving(false);
    }
  };

  const handleToggleAOActive = async (ao) => {
    try {
      const nextActive = !ao.active;
      await aoService.setAOActive(ao._id, nextActive);
      setAos((prev) =>
        prev.map((item) => (item._id === ao._id ? { ...item, active: nextActive } : item))
      );
    } catch (error) {
      setAoError('Failed to update AO status. Please try again.');
    }
  };

  const isAoModalOpen = (aoModalMode === 'create' && !!aoDraft) || (aoModalMode === 'edit' && !!selectedAO);

  // Listen for socket location responses
  useEffect(() => {
    if (!realtimeEnabled) return;

    const handleLocationResponse = (data) => {
      setUsers(data.users.map(user => ({
        ...user,
        isOnline: onlineUsers.has(user._id),
        lastUpdateAt: user.lastUpdateAt || user.lastSeen || user.updatedAt
      })));
      setLoading(false);
    };

    socketService.on('location:response', handleLocationResponse);

    return () => {
      socketService.off('location:response', handleLocationResponse);
    };
  }, [realtimeEnabled, onlineUsers]);

  useEffect(() => {
    if (!realtimeEnabled) {
      return;
    }

    const upsertAo = (incoming) => {
      if (!incoming?._id) {
        return;
      }
      setAos((prev) => {
        const index = prev.findIndex((ao) => ao._id === incoming._id);
        if (index === -1) {
          return [incoming, ...prev];
        }
        const next = [...prev];
        next[index] = incoming;
        return next;
      });
    };

    const handleAoCreated = (data) => {
      if (data?.ao) {
        upsertAo(data.ao);
      }
    };

    const handleAoUpdated = (data) => {
      if (data?.ao) {
        upsertAo(data.ao);
        setSelectedAO((prev) => (prev && prev._id === data.ao._id ? data.ao : prev));
      }
    };

    const handleAoDeleted = (data) => {
      const aoId = data?.aoId || data?.ao?._id;
      if (!aoId) {
        return;
      }
      setAos((prev) => prev.filter((ao) => ao._id !== aoId));
      setSelectedAO((prev) => (prev && prev._id === aoId ? null : prev));
    };

    socketService.on('ao:created', handleAoCreated);
    socketService.on('ao:updated', handleAoUpdated);
    socketService.on('ao:deleted', handleAoDeleted);

    return () => {
      socketService.off('ao:created', handleAoCreated);
      socketService.off('ao:updated', handleAoUpdated);
      socketService.off('ao:deleted', handleAoDeleted);
    };
  }, [realtimeEnabled]);

  useEffect(() => {
    setLocationLoading(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    const shouldSendLocation = (nextCoords) => {
      const last = lastLocationSentRef.current;
      const now = Date.now();
      if (!last.coords) {
        return true;
      }
      const [prevLat, prevLng] = last.coords;
      const [nextLat, nextLng] = nextCoords;
      const moved =
        Math.abs(prevLat - nextLat) > 0.00005 ||
        Math.abs(prevLng - nextLng) > 0.00005;
      const timeElapsed = now - last.time > 8000;
      return moved || timeElapsed;
    };

    const sendLocation = async (latitude, longitude) => {
      const nextCoords = [latitude, longitude];
      if (!shouldSendLocation(nextCoords)) {
        return;
      }

      lastLocationSentRef.current = { time: Date.now(), coords: nextCoords };

      try {
        if (realtimeEnabledRef.current && socketService.isSocketConnected()) {
          socketService.updateLocation([longitude, latitude]);
        } else if (socketInitializedRef.current) {
          await userService.updateMyLocation([longitude, latitude]);
        }
      } catch (error) {
        setLocationError('Failed to update location. Please try again.');
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = [latitude, longitude];
        if (isValidCoords(newLocation)) {
          setUserLocation(newLocation);

          if (!hasCenteredMapRef.current) {
            setMapCenter(newLocation);
            hasCenteredMapRef.current = true;
          }
        }

        await sendLocation(latitude, longitude);
        setLocationLoading(false);
      },
      () => {
        setLocationError('Unable to retrieve your location. Please enable location services.');
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
  };

  const formatTimestamp = (value) => {
    if (!value) return 'No live updates yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unavailable';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatViolationType = (type) => {
    switch (type) {
      case 'APPROACHING_BOUNDARY':
        return 'Approaching Boundary';
      case 'SUSTAINED_BREACH':
        return 'Sustained Breach';
      case 'BREACH':
      default:
        return 'Breach';
    }
  };

  const handleViewportChange = useCallback((viewport) => {
    setViewportBounds(viewport);
  }, []);

  const normalizeCoords = (raw) => {
    if (!Array.isArray(raw) || raw.length !== 2) return null;
    const [lng, lat] = raw;
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  };

  const focusViolation = (violation) => {
    const center = normalizeCoords(violation?.coordinates);
    if (center) setMapCenter(center);
  };

  const focusEvent = (ev) => {
    const center = normalizeCoords(ev?.coordinates?.coordinates);
    if (center) setMapCenter(center);
  };

  const handleEventRespond = useCallback(async (id, action) => {
    setRespondingIds((prev) => new Set([...prev, id]));
    try {
      await (action === 'acknowledge'
        ? eventApi.acknowledgeEvent(id)
        : eventApi.resolveEvent(id));
      setEventAlert((prev) => (prev?.id === id ? null : prev));
    } catch {
      // socket will resync state on next update
    } finally {
      setRespondingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const getCompanyIdentity = (ao) => {
    const company = hierarchyMap.companies[ao?.companyId];
    if (company) {
      return {
        color: company.color || DEFAULT_AO_COLOR,
        icon: company.icon || DEFAULT_AO_ICON,
        pattern: company.pattern || null
      };
    }
    return {
      color: ao?.style?.color || DEFAULT_AO_COLOR,
      icon: ao?.style?.icon || DEFAULT_AO_ICON,
      pattern: ao?.style?.pattern || null
    };
  };

  const renderAoLegendIcon = (ao) => {
    const { color, icon } = getCompanyIdentity(ao);
    const trimmedIcon = `${icon || ''}`.trim();
    const hasImage = trimmedIcon && isImageUrl(trimmedIcon);

    return (
      <span
        className="h-6 w-6 rounded-full border border-white/10 flex items-center justify-center text-[10px] text-white"
        style={{ backgroundColor: color }}
      >
        {hasImage ? (
          <img src={trimmedIcon} alt="" className="h-3.5 w-3.5" />
        ) : (
          trimmedIcon
        )}
      </span>
    );
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Navbar realtimeStatus={realtimeStatus} />

      {realtimeNotice && (
        <div className="px-6 pt-4 shrink-0">
          <AlertBanner
            message={realtimeNotice}
            tone={realtimeNoticeTone === 'error' ? 'error' : 'warning'}
            onDismiss={() => setRealtimeNotice('')}
          />
        </div>
      )}

      {eventAlert && (
        <div className="px-6 pt-3 shrink-0">
          <AlertBanner
            message={eventAlert.message}
            tone={eventAlert.tone}
            onDismiss={() => setEventAlert(null)}
            action={eventAlert.id ? {
              label: 'ACK',
              onClick: () => handleEventRespond(eventAlert.id, 'acknowledge'),
              disabled: respondingIds.has(eventAlert.id),
            } : undefined}
          />
        </div>
      )}

      <div className="px-6 pt-3 shrink-0">
        <NotificationPrompt />
      </div>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden shrink-0 flex items-center gap-2 px-4 pt-3">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-gold text-sm min-h-[44px] min-w-[44px]"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>{sidebarOpen ? 'Hide Panel' : 'Show Panel'}</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - User List */}
        <div className={`${sidebarOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 glass-card border-b lg:border-b-0 lg:border-r border-gold/20 p-6 overflow-hidden flex-col lg:h-full max-h-[60vh] lg:max-h-none`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gold">Nearby Users</h2>
            <div className="flex items-center space-x-2">
              {realtimeEnabled && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-400">Live</span>
                </div>
              )}
              <span className="text-sm text-gold/60 bg-gold/10 px-3 py-1 rounded-full">
                {users.length} found
              </span>
            </div>
          </div>

          {/* Location Controls */}
          <Card className="mb-6" padding="small">
            <div className="space-y-4">
              <div className="rounded-lg border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-gold/80">
                {locationLoading ? 'Detecting your live location…' : 'Live location updates are active.'}
              </div>
              
              {locationError && (
                <p className="text-red-400 text-sm">{locationError}</p>
              )}

              <div className="space-y-2">
                <label className="text-sm text-gold">Search Radius: {radius} km</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={radius}
                  onChange={(e) => handleRadiusChange(Number(e.target.value))}
                  className="w-full accent-gold"
                />
              </div>
            </div>
          </Card>

          {/* AO Controls */}
          <Card className="mb-6" padding="small">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gold">Area Overlays</h3>
                <span className="text-xs text-gold/60">{aos.length} saved</span>
              </div>
              <p className="text-xs text-gold/60">
                {canManageAOs
                  ? 'Use the polygon tool on the map to draw a new AO. Use the edit tool to reshape saved polygons.'
                  : 'Viewing active overlays. Contact a commander to add or edit coverage.'}
              </p>
              {aoError && (
                <p className="text-xs text-red-400">{aoError}</p>
              )}
              <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                {aoLoading ? (
                  <div className="text-xs text-gold/50">Loading overlays...</div>
                ) : aos.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-gold/40 gap-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-xs">No AOs defined yet</p>
                    {canManageAOs && <p className="text-[10px] text-gold/30">Draw one on the map above</p>}
                  </div>
                ) : (
                  aos.map((ao) => (
                    <div
                      key={ao._id}
                      className="flex items-center justify-between rounded-lg border border-gold/10 px-3 py-2"
                      style={{ borderColor: ao.style?.color || DEFAULT_AO_COLOR }}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        {renderAoLegendIcon(ao)}
                        <div className="min-w-0">
                          <p className="text-sm text-gold truncate">{ao.name}</p>
                          <p className="text-[11px] text-gold/50">
                            {ao.active ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                      {canManageAOs && (
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-xs text-gold/70 hover:text-gold"
                            onClick={() => handleAOSelect(ao)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs text-gold/70 hover:text-gold"
                            onClick={() => handleToggleAOActive(ao)}
                          >
                            {ao.active ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          {/* Field Events panel — visible to all users */}
          <Card className="mb-6" padding="small">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gold">Field Events</h3>
                <div className="flex items-center gap-2">
                  {activeEventCount > 0 && (
                    <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
                      {activeEventCount} ACTIVE
                    </span>
                  )}
                  <span className="text-xs text-gold/60">{visibleEvents.length}</span>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gold/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showResolvedEvents}
                  onChange={(e) => setShowResolvedEvents(e.target.checked)}
                  className="accent-gold"
                />
                Show resolved
              </label>
              <div className="space-y-2 max-h-44 overflow-y-auto scrollbar-thin">
                {fieldEventsLoading ? (
                  <div className="text-xs text-gold/50">Loading events...</div>
                ) : visibleEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-gold/40 gap-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs">No active field events</p>
                  </div>
                ) : (
                  visibleEvents.map((ev) => {
                    const cfg        = EVENT_TYPE_CONFIG[ev.eventType] || { color: '#6b7280', label: ev.eventType, glyph: '?' };
                    const isPending  = respondingIds.has(ev._id);
                    const canAck     = ev.status === 'ACTIVE';
                    const canResolve = ev.status === 'ACTIVE' || ev.status === 'ACKNOWLEDGED';
                    return (
                      <div
                        key={ev._id}
                        className="rounded-lg border border-gold/10 px-3 py-2 hover:border-gold/30 transition-colors"
                      >
                        {/* Row header — click to focus map */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => focusEvent(ev)}
                          onKeyDown={(e) => e.key === 'Enter' && focusEvent(ev)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: cfg.color }}
                            >
                              {cfg.glyph}
                            </span>
                            <span className="text-xs text-gold/80 font-semibold">{cfg.label}</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE_CLASS[ev.status] ?? STATUS_BADGE_CLASS.RESOLVED}`}>
                            {ev.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gold/50 mt-0.5">
                          {new Date(ev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {(canAck || canResolve) && (
                          <div className="flex gap-1.5 mt-2">
                            {canAck && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleEventRespond(ev._id, 'acknowledge')}
                                className="flex-1 text-[10px] font-semibold py-1 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 transition-colors"
                              >
                                {isPending ? '…' : 'ACK'}
                              </button>
                            )}
                            {canResolve && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleEventRespond(ev._id, 'resolve')}
                                className="flex-1 text-[10px] font-semibold py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
                              >
                                {isPending ? '…' : 'RESOLVE'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>

          {canViewViolations && (
            <Card className="mb-6" padding="small">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gold">Violation History</h3>
                  <span className="text-xs text-gold/60">{violations.length} recent</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="dark-input w-full text-xs"
                    value={violationFilters.severity}
                    onChange={(event) =>
                      setViolationFilters((prev) => ({ ...prev, severity: event.target.value }))
                    }
                  >
                    <option value="all">All severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <select
                    className="dark-input w-full text-xs"
                    value={violationFilters.companyId}
                    onChange={(event) =>
                      setViolationFilters((prev) => ({ ...prev, companyId: event.target.value }))
                    }
                  >
                    <option value="">All companies</option>
                    {companyOptions.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="dark-input w-full text-xs"
                    value={violationFilters.start}
                    onChange={(event) =>
                      setViolationFilters((prev) => ({ ...prev, start: event.target.value }))
                    }
                  />
                  <input
                    type="date"
                    className="dark-input w-full text-xs"
                    value={violationFilters.end}
                    onChange={(event) =>
                      setViolationFilters((prev) => ({ ...prev, end: event.target.value }))
                    }
                  />
                </div>
                {violationError && (
                  <p className="text-xs text-red-400">{violationError}</p>
                )}
                <div className="space-y-2 max-h-44 overflow-y-auto scrollbar-thin">
                  {violationLoading ? (
                    <div className="text-xs text-gold/50">Loading violations...</div>
                  ) : violations.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-gold/40 gap-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs">No violations recorded</p>
                    </div>
                  ) : (
                    violations.map((violation) => (
                      <button
                        key={violation._id}
                        type="button"
                        onClick={() => focusViolation(violation)}
                        className="w-full text-left rounded-lg border border-gold/10 px-3 py-2 hover:border-gold/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gold/80 font-semibold">
                            {formatViolationType(violation.type)}
                          </span>
                          <span className="text-[11px] text-gold/50">
                            {formatTimestamp(violation.occurredAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-gold/50 mt-1">
                          {violation.aoName || 'Unknown AO'} •{' '}
                          {hierarchyMap.companies[violation.companyId]?.name || 'Company'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* User List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card rounded-lg p-4 loading-skeleton h-20" />
              ))
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gold/60">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p>No users found nearby</p>
                <p className="text-sm">Try increasing the search radius</p>
              </div>
            ) : (
              users.map((user) => (
                <Card
                  key={user._id}
                  padding="small"
                  className="cursor-pointer hover:shadow-gold-glow transition-all"
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-2">
                           <p className="text-gold font-medium truncate">{user.name}</p>
                           {user.isOnline && (
                             <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                           )}
                         </div>
                         {user.distance && (
                           <p className="text-gold/40 text-xs">{user.distance} km</p>
                         )}
                       </div>
                       <p className="text-gold/60 text-sm truncate">{user.email}</p>
                     </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-0 p-4 lg:p-6">
          <Card className="h-full p-0">
            <MapComponent
              center={mapCenter}
              users={users}
              userLocation={userLocation}
              onUserClick={setSelectedUser}
              liveUpdateIds={liveUpdateIds}
              onViewportChange={handleViewportChange}
              aos={aos}
              onAOCreate={handleAOCreate}
              onAOEdit={handleAOEdit}
              onAODelete={handleAODelete}
              onAOSelect={handleAOSelect}
              featureGroupRef={featureGroupRef}
              canManageAOs={canManageAOs}
              getCompanyIdentity={getCompanyIdentity}
              fieldEvents={visibleEvents}
              onEventClick={focusEvent}
            />
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isAoModalOpen}
        onClose={handleAOCancel}
        title={aoModalMode === 'create' ? 'Save Area Overlay' : 'Edit Area Overlay'}
        size="small"
        closeOnBackdrop={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gold">Owning Company</label>
            <select
              className="dark-input w-full"
              value={aoForm.companyId}
              onChange={(event) => {
                const value = event.target.value;
                setAoForm((prev) => ({ ...prev, companyId: value }));
              }}
              disabled={visibleCompanies.length === 1 && currentUser?.role !== 'admin'}
            >
              <option value="" disabled>Select company</option>
              {visibleCompanies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gold">AO Name</label>
            <input
              className="dark-input w-full"
              type="text"
              placeholder="e.g. North Sector"
              value={aoForm.name}
              onChange={(event) => {
                const value = event.target.value;
                setAoForm((prev) => ({ ...prev, name: value }));
                if (!value.trim()) {
                  setAoNameError('Name is required.');
                } else if (value.trim().length < AO_NAME_MIN) {
                  setAoNameError(`Name must be at least ${AO_NAME_MIN} characters.`);
                } else if (value.trim().length > AO_NAME_MAX) {
                  setAoNameError(`Name must be ${AO_NAME_MAX} characters or fewer.`);
                } else {
                  setAoNameError('');
                }
              }}
            />
            {aoNameError && <p className="text-xs text-red-400">{aoNameError}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gold">Overlay Color</label>
            <input
              type="color"
              value={aoForm.color}
              onChange={(event) => setAoForm((prev) => ({ ...prev, color: event.target.value }))}
              className="h-10 w-20 rounded border border-gold/30 bg-transparent"
              disabled
            />
            <p className="text-xs text-gold/60">Color derives from the owning company identity.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gold">Overlay Icon</label>
            <div className="flex items-center space-x-3">
              <span
                className="h-10 w-10 rounded-full border border-gold/30 flex items-center justify-center text-sm text-white"
                style={{ backgroundColor: aoForm.color }}
              >
                {aoForm.icon && isImageUrl(aoForm.icon) ? (
                  <img src={aoForm.icon} alt="" className="h-5 w-5" />
                ) : (
                  (aoForm.icon || '').slice(0, 2)
                )}
              </span>
              <input
                className="dark-input w-full"
                type="text"
                placeholder="Company icon"
                value={aoForm.icon}
                onChange={(event) => {
                  const value = event.target.value;
                  setAoForm((prev) => ({ ...prev, icon: value }));
                  if (!isValidIconValue(value)) {
                    setAoIconError(`Use an image URL/path or ${AO_ICON_MAX_LENGTH} characters or fewer.`);
                  } else {
                    setAoIconError('');
                  }
                }}
                disabled
              />
            </div>
            <p className="text-xs text-gold/60">
              Icon derives from the owning company identity.
            </p>
            {aoIconError && <p className="text-xs text-red-400">{aoIconError}</p>}
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Button variant="ghost" onClick={handleAOCancel}>
              Cancel
            </Button>
            <Button onClick={handleAOSubmit} disabled={aoSaving || !!aoIconError || !!aoNameError}>
              {aoSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* User Details Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Details"
        size="small"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-gold to-gold-light rounded-full flex items-center justify-center text-jet text-2xl font-bold">
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gold">{selectedUser.name}</h3>
                <p className="text-gold/60">{selectedUser.email}</p>
                <p className="text-gold/40 text-sm">Role: {selectedUser.role}</p>
              </div>
            </div>
            
            {selectedUser.distance && (
              <div className="glass-card rounded-lg p-3">
                <p className="text-gold text-sm">
                  <span className="text-gold/60">Distance:</span> {selectedUser.distance} km
                </p>
              </div>
            )}

            <div className="glass-card rounded-lg p-3">
              <p className="text-gold/60 text-sm mb-2">Location</p>
              {(() => {
                const coords = safeGetCoords(selectedUser);
                if (!isValidCoords(coords)) {
                  return <p className="text-gold/40 italic">No location yet</p>;
                }
                return (
                  <>
                    <p className="text-gold text-sm">
                      Lat: {coords[1].toFixed(6)}
                    </p>
                    <p className="text-gold text-sm">
                      Lng: {coords[0].toFixed(6)}
                    </p>
                  </>
                );
              })()}
            </div>

            <div className="glass-card rounded-lg p-3">
              <p className="text-gold/60 text-sm mb-2">Last Update</p>
              <p className="text-gold text-sm">
                {formatTimestamp(selectedUser.lastUpdateAt || selectedUser.lastSeen || selectedUser.updatedAt)}
              </p>
            </div>

            <div className="glass-card rounded-lg p-3">
              <p className="text-gold/60 text-sm mb-2">Hierarchy</p>
              <div className="space-y-2 text-sm text-gold">
                <div className="flex justify-between">
                  <span className="text-gold/60">Unit:</span>
                  <span>{hierarchyMap.units[selectedUser.unitId] || selectedUser.unitId || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gold/60">Company:</span>
                  <span>{hierarchyMap.companies[selectedUser.companyId]?.name || selectedUser.companyId || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gold/60">Team:</span>
                  <span>{hierarchyMap.teams[selectedUser.teamId] || selectedUser.teamId || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gold/60">Squad:</span>
                  <span>{hierarchyMap.squads[selectedUser.squadId] || selectedUser.squadId || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;

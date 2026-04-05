import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import socketService from '../../services/socketService';
import { safeGetCoords, isValidCoords } from '../../utils/location';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../../config/constants';

// Self marker (gold-tinted) vs teammate marker (default blue)
const SELF_ICON = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [0, -32],
  className: 'hue-rotate-[30deg] brightness-125'
});

const TEAMMATE_ICON = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [18, 28],
  iconAnchor: [9, 28],
  popupAnchor: [0, -28]
});

// ── Field-event marker icons ──────────────────────────────────────────────────
// Mirrors the icon approach in Dashboard so mobile and desktop show identical markers.

const svgToDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const EVENT_MARKER_CONFIG = {
  INJURED: {
    color: '#ef4444',
    svgPath: `<path d="M19 11 L19 27 M11 19 L27 19" stroke="white" stroke-width="5" stroke-linecap="round"/>`
  },
  AMBUSH: {
    color: '#f97316',
    svgPath: `<path d="M19 11 L19 23" stroke="white" stroke-width="4.5" stroke-linecap="round"/><circle cx="19" cy="28.5" r="2.8" fill="white"/>`
  },
  LINK_UP: {
    color: '#3b82f6',
    svgPath: `<path d="M10 19 L19 10 L28 19 M19 10 L19 27" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  },
};

const EVENT_STATUS_OPACITY = { ACTIVE: 1, ACKNOWLEDGED: 0.7, RESOLVED: 0.4 };
const EVENT_TYPE_LABELS    = { INJURED: 'Injured', AMBUSH: 'Ambush', LINK_UP: 'Link Up' };

const buildEventMarkerSvg = (eventType, status) => {
  const cfg = EVENT_MARKER_CONFIG[eventType] || { color: '#6b7280', svgPath: '' };
  return `<svg width="28" height="36" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${EVENT_STATUS_OPACITY[status] ?? 0.4}">
  <defs><filter id="evs" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.6)"/></filter></defs>
  <path d="M19 2 C9 2 1 10 1 20 C1 30 19 46 19 46 C19 46 37 30 37 20 C37 10 29 2 19 2Z" fill="${cfg.color}" filter="url(#evs)"/>
  <circle cx="19" cy="19" r="13" fill="rgba(0,0,0,0.25)"/>
  ${cfg.svgPath}
</svg>`;
};

// Cache icons by type+status to avoid recreating Leaflet Icon objects on every render
const eventIconCache = new Map();
const getEventIcon = (eventType, status) => {
  const key = `${eventType}:${status}`;
  if (!eventIconCache.has(key)) {
    eventIconCache.set(key, new L.Icon({
      iconUrl:     svgToDataUrl(buildEventMarkerSvg(eventType, status)),
      iconSize:    [28, 36],
      iconAnchor:  [14, 35],
      popupAnchor: [0, -36],
      className:   status === 'ACTIVE' ? 'event-marker-active' : '',
    }));
  }
  return eventIconCache.get(key);
};

// ─────────────────────────────────────────────────────────────────────────────

const MapController = ({ center, triggerFly, focusCoords, onFocusConsumed }) => {
  const map = useMap();
  // hasCenteredRef: ensures we fly to the user's real GPS position exactly once,
  // automatically, on first lock — without requiring a button press.
  // MapContainer.center is an initial-value-only prop; Leaflet ignores subsequent
  // prop changes, so this effect bridges that gap.
  const hasCenteredRef = useRef(false);

  // Initial size + delayed fallback.
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-center once on first valid GPS fix
  useEffect(() => {
    if (!isValidCoords(center) || hasCenteredRef.current) return;
    hasCenteredRef.current = true;
    map.setView(center, map.getZoom(), { animate: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center]);

  // Animated fly triggered by the user pressing the center-on-me FAB
  useEffect(() => {
    if (!isValidCoords(center)) return;
    map.flyTo(center, map.getZoom(), { animate: true, duration: 0.8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFly]);

  // External focus: fly to an event location from the feed "Show on map" button.
  // focusCoords is [lng, lat] (GeoJSON order); convert to Leaflet [lat, lng].
  useEffect(() => {
    if (!Array.isArray(focusCoords) || focusCoords.length !== 2) return;
    map.flyTo([focusCoords[1], focusCoords[0]], 16, { animate: true, duration: 0.8 });
    onFocusConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCoords]);

  return null;
};

/**
 * MobileFieldMap — full-screen tactical map; always the base layer of MobileLayout.
 *
 * Props:
 *   userCoordinates  {[lng, lat] | null}  — own GPS position (GeoJSON order)
 *   events           {FieldEvent[]}       — field events to show as map markers
 *   focusCoords      {[lng, lat] | null}  — fly to this position (GeoJSON order) when set
 *   onFocusConsumed  {fn}                 — called after focusCoords is consumed (clear it)
 *   initialZoom      {number}             — override default zoom
 *   showZoomControl  {boolean}            — show Leaflet zoom buttons
 *   gpsStatus        {string}             — 'locked' | 'searching' | 'unavailable'
 */
const MobileFieldMap = ({
  userCoordinates,
  events = [],
  focusCoords = null,
  onFocusConsumed,
  initialZoom = DEFAULT_MAP_ZOOM,
  showZoomControl = false,
  gpsStatus = 'searching'
}) => {
  const [teammates, setTeammates] = useState([]);
  const [flyTrigger, setFlyTrigger] = useState(0);

  useEffect(() => {
    const trySubscribe = () => {
      try { socketService.subscribeToPresence(); } catch (_) {}
    };
    trySubscribe();

    const handlePresence  = ({ users }) => setTeammates(users || []);
    const handleJoin      = (data) =>
      setTeammates((prev) => prev.find((u) => u.userId === data.userId) ? prev : [...prev, data]);
    const handleLeft      = ({ userId }) =>
      setTeammates((prev) => prev.filter((u) => u.userId !== userId));
    const handleUpdate    = (data) =>
      setTeammates((prev) =>
        prev.map((u) => (u.userId === data.userId ? { ...u, location: data.location } : u))
      );

    socketService.on('connect',              trySubscribe);
    socketService.on('presence:users',       handlePresence);
    socketService.on('presence:user_joined', handleJoin);
    socketService.on('presence:user_left',   handleLeft);
    socketService.on('location:update',      handleUpdate);

    return () => {
      socketService.off('connect',              trySubscribe);
      socketService.off('presence:users',       handlePresence);
      socketService.off('presence:user_joined', handleJoin);
      socketService.off('presence:user_left',   handleLeft);
      socketService.off('location:update',      handleUpdate);
    };
  }, []);

  const handleCenterOnMe = useCallback(() => {
    if (isValidCoords(userCoordinates)) setFlyTrigger((n) => n + 1);
  }, [userCoordinates]);

  // [lng,lat] → [lat,lng] for Leaflet.
  // Falls back to NYC only for MapContainer's initial mount center;
  // MapController.hasCenteredRef will override it on first GPS lock.
  const center = isValidCoords(userCoordinates)
    ? [userCoordinates[1], userCoordinates[0]]
    : DEFAULT_MAP_CENTER;

  const onlineCount = teammates.filter((t) => t.isOnline).length;

  // Pre-filter events to only those with valid GeoJSON coordinates
  const visibleEvents = events.filter((ev) => {
    const c = ev.coordinates?.coordinates;
    return Array.isArray(c) && c.length === 2 &&
      Number.isFinite(c[0]) && Number.isFinite(c[1]);
  });

  return (
    /*
     * `absolute inset-0 z-0` fills the parent (MobileLayout's relative root, 100dvh)
     * and creates an isolated stacking context at z-0.  All map-internal z-indexes
     * (tiles, popups, our overlays at z-[100]) are scoped within this context, so
     * the floating header and nav at z-[500] always render above the map without
     * needing artificially high z-values inside the map.
     */
    <div className="absolute inset-0 z-0">

      {/* ── Location permission denied overlay ──────────────────────────── */}
      {gpsStatus === 'unavailable' && !userCoordinates && (
        <div className="absolute inset-x-4 z-[100]
          flex flex-col gap-2 rounded-xl border border-red-500/40
          bg-jet/95 backdrop-blur-sm p-4 shadow-[0_0_24px_rgba(239,68,68,0.2)]"
          style={{ top: 'calc(3.5rem + 0.75rem)' }}
        >
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm tracking-wide">
            <span className="text-base leading-none">⊗</span>
            Location access blocked
          </div>
          <p className="text-gold/70 text-xs leading-relaxed">
            Fox-Eye needs your location to show your position and attach coordinates to field signals.
          </p>
          <p className="text-gold/50 text-xs leading-relaxed">
            Open your browser&apos;s <strong className="text-gold/70">site settings</strong> →{' '}
            <strong className="text-gold/70">Location</strong> → set to{' '}
            <strong className="text-gold/70">Allow</strong>, then reload the page.
          </p>
        </div>
      )}

      {/* ── Teammate count badge ─────────────────────────────────────────── */}
      <div className="absolute z-[100] flex items-center gap-1.5 px-2.5 py-1.5
        bg-jet/80 backdrop-blur-sm rounded-full border border-gold/30
        text-[10px] tracking-widest text-gold/70 uppercase pointer-events-none"
        style={{ top: 'calc(3.5rem + 0.75rem)', left: '0.75rem' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {onlineCount} online
      </div>

      {/* ── Center-on-me FAB ─────────────────────────────────────────────── */}
      <button
        onClick={handleCenterOnMe}
        disabled={!isValidCoords(userCoordinates)}
        aria-label="Center map on my location"
        title="Center on me"
        className="absolute right-4 z-[100]
          w-11 h-11 rounded-full flex items-center justify-center
          bg-charcoal/90 border border-gold/40 text-gold text-lg
          shadow-gold-glow backdrop-blur-sm transition-all duration-150
          hover:bg-slate-dark active:scale-95
          disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        ◎
      </button>

      {/*
        MapContainer wrapper: `absolute inset-0` gives Leaflet explicit pixel bounds
        that resolve correctly on all browsers.  height:100% through flex-item chains
        fails on mobile Safari; absolute inset-0 never does.
      */}
      <div className="absolute inset-0">
        <MapContainer
          center={center}
          zoom={initialZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {showZoomControl && <ZoomControl position="bottomleft" />}

          <MapController
            center={center}
            triggerFly={flyTrigger}
            focusCoords={focusCoords}
            onFocusConsumed={onFocusConsumed}
          />

          {/* Own position marker */}
          {isValidCoords(userCoordinates) && (
            <Marker
              position={[userCoordinates[1], userCoordinates[0]]}
              icon={SELF_ICON}
              zIndexOffset={1000}
            >
              <Popup>
                <div className="text-sm font-bold">You</div>
              </Popup>
            </Marker>
          )}

          {/* Teammate markers */}
          {teammates.map((teammate) => {
            const coords = safeGetCoords(teammate);
            if (!coords) return null;
            return (
              <Marker
                key={teammate.userId}
                position={[coords[1], coords[0]]}
                icon={TEAMMATE_ICON}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold">{teammate.name}</div>
                    <div className="text-xs opacity-70">{teammate.operationalRole}</div>
                    {teammate.isOnline && (
                      <div className="text-xs text-green-600 mt-0.5">● Online</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Field event markers — same icon style as desktop Dashboard */}
          {visibleEvents.map((ev) => {
            const [lng, lat] = ev.coordinates.coordinates;
            const label = EVENT_TYPE_LABELS[ev.eventType] || ev.eventType;
            return (
              <Marker
                key={ev._id}
                position={[lat, lng]}
                icon={getEventIcon(ev.eventType, ev.status)}
                zIndexOffset={ev.status === 'ACTIVE' ? 500 : 0}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold">{label}</div>
                    <div className="text-xs opacity-70">
                      {ev.senderId?.name || 'Unknown'}
                      {ev.senderId?.operationalRole
                        ? ` · ${ev.senderId.operationalRole.replace(/_/g, ' ')}`
                        : ''}
                    </div>
                    <div className="text-xs mt-0.5 opacity-60">{ev.status}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default MobileFieldMap;

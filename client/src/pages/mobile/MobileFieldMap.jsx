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

const MapController = ({ center, triggerFly }) => {
  const map = useMap();
  // hasCenteredRef: ensures we fly to the user's real GPS position exactly once,
  // automatically, on first lock — without requiring a button press.
  // MapContainer.center is an initial-value-only prop; Leaflet ignores subsequent
  // prop changes, so this effect bridges that gap.
  const hasCenteredRef = useRef(false);

  // Initial size + delayed fallback.
  // The flex/absolute layout on mobile may not be fully settled when this first
  // fires, so a second call at 300 ms catches any residual 0-px computation.
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-center once on first valid GPS fix — silent snap, no animation,
  // so the map doesn't jolt while GPS is still settling.
  useEffect(() => {
    if (!isValidCoords(center) || hasCenteredRef.current) return;
    hasCenteredRef.current = true;
    map.setView(center, map.getZoom(), { animate: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center]);

  // Animated fly triggered by the user pressing the center-on-me FAB.
  useEffect(() => {
    if (!isValidCoords(center)) return;
    map.flyTo(center, map.getZoom(), { animate: true, duration: 0.8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFly]);

  return null;
};

/**
 * MobileFieldMap — full-screen tactical map; always the base layer of MobileLayout.
 * Sits at z-0 within the layout container so floating chrome (header, nav, sheet)
 * naturally renders above it.
 *
 * Props:
 *   userCoordinates  {[lng, lat] | null}  — own GPS position (GeoJSON order)
 *   initialZoom      {number}             — override default zoom
 *   showZoomControl  {boolean}            — show Leaflet zoom buttons
 *   gpsStatus        {string}             — 'locked' | 'searching' | 'unavailable';
 *                                           drives the permission-denied overlay
 */
const MobileFieldMap = ({
  userCoordinates,
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
          style={{ top: 'calc(3.5rem + 0.75rem)' }}   // clears the floating header
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

          <MapController center={center} triggerFly={flyTrigger} />

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
        </MapContainer>
      </div>
    </div>
  );
};

export default MobileFieldMap;

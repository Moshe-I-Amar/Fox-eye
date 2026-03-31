import React, { useEffect, useState, useCallback } from 'react';
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
  className: 'hue-rotate-[30deg] brightness-125'   // CSS filter for gold tint
});

const TEAMMATE_ICON = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [18, 28],
  iconAnchor: [9, 28],
  popupAnchor: [0, -28]
});

const MapController = ({ center, triggerFly }) => {
  const map = useMap();
  useEffect(() => {
    if (!isValidCoords(center)) return;
    map.flyTo(center, map.getZoom(), { animate: true, duration: 0.8 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFly]);   // only fly when user explicitly presses "center on me"
  return null;
};

/**
 * MobileFieldMap — hierarchy-scoped tactical map.
 *
 * Props:
 *   userCoordinates  {[lng, lat] | null}  — own GPS position
 *   initialZoom      {number}             — override default zoom (default: DEFAULT_MAP_ZOOM)
 *   showZoomControl  {boolean}            — show zoom buttons (default: false on mobile)
 */
const MobileFieldMap = ({
  userCoordinates,
  initialZoom = DEFAULT_MAP_ZOOM,
  showZoomControl = false
}) => {
  const [teammates, setTeammates] = useState([]);
  const [flyTrigger, setFlyTrigger] = useState(0);

  useEffect(() => {
    socketService.subscribeToPresence();

    const handlePresence = ({ users }) => setTeammates(users || []);

    const handleJoin = (data) =>
      setTeammates((prev) => {
        const exists = prev.find((u) => u.userId === data.userId);
        return exists ? prev : [...prev, data];
      });

    const handleLeft = ({ userId }) =>
      setTeammates((prev) => prev.filter((u) => u.userId !== userId));

    const handleUpdate = (data) =>
      setTeammates((prev) =>
        prev.map((u) => (u.userId === data.userId ? { ...u, location: data.location } : u))
      );

    socketService.on('presence:users',       handlePresence);
    socketService.on('presence:user_joined', handleJoin);
    socketService.on('presence:user_left',   handleLeft);
    socketService.on('location:update',      handleUpdate);

    return () => {
      socketService.off('presence:users',       handlePresence);
      socketService.off('presence:user_joined', handleJoin);
      socketService.off('presence:user_left',   handleLeft);
      socketService.off('location:update',      handleUpdate);
    };
  }, []);

  const handleCenterOnMe = useCallback(() => {
    if (isValidCoords(userCoordinates)) {
      setFlyTrigger((n) => n + 1);
    }
  }, [userCoordinates]);

  // [lng,lat] → [lat,lng] for Leaflet
  const center = isValidCoords(userCoordinates)
    ? [userCoordinates[1], userCoordinates[0]]
    : DEFAULT_MAP_CENTER;

  const onlineCount = teammates.filter((t) => t.isOnline).length;

  return (
    // h-full fills the flex-1 container from MobileLayout — no hardcoded pixel height
    <div className="relative h-full w-full">

      {/* Teammate count badge */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5
        bg-jet/80 backdrop-blur-sm rounded-full border border-gold/30 text-[10px] tracking-widest
        text-gold/70 uppercase pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {onlineCount} online
      </div>

      {/* Center-on-me FAB */}
      <button
        onClick={handleCenterOnMe}
        disabled={!isValidCoords(userCoordinates)}
        aria-label="Center map on my location"
        title="Center on me"
        className="absolute bottom-4 right-4 z-[1000]
          w-11 h-11 rounded-full flex items-center justify-center
          bg-charcoal border border-gold/40 text-gold text-lg
          shadow-gold-glow transition-all duration-150
          hover:bg-slate-dark active:scale-95
          disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ◎
      </button>

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

        {/* Own position */}
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

        {/* Teammates */}
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
  );
};

export default MobileFieldMap;

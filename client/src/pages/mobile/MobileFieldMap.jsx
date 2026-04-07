import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import socketService from '../../services/socketService';
import { safeGetCoords, isValidCoords } from '../../utils/location';
import { getEventIconCached, EVENT_TYPE_CONFIG, createClusterMarkerIcon } from '../../utils/markerUtils';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../../config/constants';
import styles from './MobileFieldMap.module.scss';

const CLUSTER_PRECISION = 4; // ~11m
const CLUSTER_COLOR = '#C7A76C'; // gold — no AO color context on mobile

const SELF_ICON = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [20, 32], iconAnchor: [10, 32], popupAnchor: [0, -32],
  className: 'hue-rotate-[30deg] brightness-125'
});
const TEAMMATE_ICON = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [18, 28], iconAnchor: [9, 28], popupAnchor: [0, -28]
});

const MapController = ({ center, triggerFly, focusCoords, onFocusConsumed }) => {
  const map = useMap();
  const hasCenteredRef = useRef(false);
  useEffect(() => { map.invalidateSize(); const t = setTimeout(() => map.invalidateSize(), 300); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isValidCoords(center) || hasCenteredRef.current) return; hasCenteredRef.current = true; map.setView(center, map.getZoom(), { animate: false }); }, [center]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isValidCoords(center)) return; map.flyTo(center, 16, { animate: true, duration: 0.8 }); }, [triggerFly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!Array.isArray(focusCoords) || focusCoords.length !== 2) return; map.flyTo([focusCoords[1], focusCoords[0]], 16, { animate: true, duration: 0.8 }); onFocusConsumed?.(); }, [focusCoords]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

/**
 * MobileFieldMap — full-screen tactical map; always the base layer of MobileLayout.
 * Props: userCoordinates [lng,lat], events, focusCoords [lng,lat], onFocusConsumed,
 *        initialZoom, showZoomControl, gpsStatus
 */
const MobileFieldMap = ({ userCoordinates, events = [], focusCoords = null, onFocusConsumed, initialZoom = DEFAULT_MAP_ZOOM, showZoomControl = false, gpsStatus = 'searching' }) => {
  const [teammates, setTeammates] = useState([]);
  const [flyTrigger, setFlyTrigger] = useState(0);

  useEffect(() => {
    const trySubscribe = () => { try { socketService.subscribeToPresence(); } catch (_) {} };
    trySubscribe();
    const handlePresence  = ({ users }) => setTeammates(users || []);
    const handleJoin      = (data) => setTeammates((prev) => prev.find((u) => u.userId === data.userId) ? prev : [...prev, data]);
    const handleLeft      = ({ userId }) => setTeammates((prev) => prev.filter((u) => u.userId !== userId));
    const handleUpdate    = (data) => setTeammates((prev) => prev.map((u) => u.userId === data.userId ? { ...u, location: data.location } : u));
    socketService.on('connect', trySubscribe); socketService.on('presence:users', handlePresence);
    socketService.on('presence:user_joined', handleJoin); socketService.on('presence:user_left', handleLeft); socketService.on('location:update', handleUpdate);
    return () => {
      socketService.off('connect', trySubscribe); socketService.off('presence:users', handlePresence);
      socketService.off('presence:user_joined', handleJoin); socketService.off('presence:user_left', handleLeft); socketService.off('location:update', handleUpdate);
    };
  }, []);

  const handleCenterOnMe = useCallback(() => { if (isValidCoords(userCoordinates)) setFlyTrigger((n) => n + 1); }, [userCoordinates]);
  const center = isValidCoords(userCoordinates) ? [userCoordinates[1], userCoordinates[0]] : DEFAULT_MAP_CENTER;
  const onlineCount = teammates.filter((t) => t.isOnline).length;
  const visibleEvents = events.filter((ev) => { const c = ev.coordinates?.coordinates; return Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]); });

  // Group co-located teammates into clusters
  const teammateGroups = useMemo(() => {
    const groups = new Map();
    for (const t of teammates) {
      const coords = safeGetCoords(t);
      if (!coords) continue;
      const key = `${coords[0].toFixed(CLUSTER_PRECISION)},${coords[1].toFixed(CLUSTER_PRECISION)}`;
      if (!groups.has(key)) groups.set(key, { coords, members: [] });
      groups.get(key).members.push(t);
    }
    return Array.from(groups.values());
  }, [teammates]);

  const clusterIconCache = useRef(new Map());
  const getClusterIcon = useCallback((count) => {
    if (!clusterIconCache.current.has(count)) {
      clusterIconCache.current.set(count, createClusterMarkerIcon({ color: CLUSTER_COLOR, count }));
    }
    return clusterIconCache.current.get(count);
  }, []);

  return (
    <div className={styles.mapRoot}>
      {gpsStatus === 'unavailable' && !userCoordinates && (
        <div className={styles.gpsBlockedOverlay}>
          <div className={styles.gpsBlockedTitle}><span className={styles.gpsBlockedIcon}>⊗</span> Location access blocked</div>
          <p className={styles.gpsBlockedBody}>Fox-Eye needs your location to show your position and attach coordinates to field signals.</p>
          <p className={styles.gpsBlockedHint}>Open your browser&apos;s <strong>site settings</strong> → <strong>Location</strong> → set to <strong>Allow</strong>, then reload the page.</p>
        </div>
      )}
      <div className={styles.onlineBadge}><span className={styles.onlineDot} />{onlineCount} online</div>
      <button onClick={handleCenterOnMe} disabled={!isValidCoords(userCoordinates)} aria-label="Center map on my location" title="Center on me" className={styles.locateMeFab}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
      </button>
      <div className={styles.mapWrapper}>
        <MapContainer center={center} zoom={initialZoom} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {showZoomControl && <ZoomControl position="bottomleft" />}
          <MapController center={center} triggerFly={flyTrigger} focusCoords={focusCoords} onFocusConsumed={onFocusConsumed} />
          {isValidCoords(userCoordinates) && <Marker position={[userCoordinates[1], userCoordinates[0]]} icon={SELF_ICON} zIndexOffset={1000}><Popup><div className="text-sm font-bold">You</div></Popup></Marker>}
          {teammateGroups.map(({ coords, members }) => {
            const clusterKey = `tm:${coords[0].toFixed(CLUSTER_PRECISION)},${coords[1].toFixed(CLUSTER_PRECISION)}`;
            if (members.length === 1) {
              const t = members[0];
              return (
                <Marker key={t.userId} position={[coords[1], coords[0]]} icon={TEAMMATE_ICON}>
                  <Popup><div className="text-sm"><div className="font-bold">{t.name}</div><div className="text-xs opacity-70">{t.operationalRole}</div>{t.isOnline && <div className="text-xs text-green-600 mt-0.5">● Online</div>}</div></Popup>
                </Marker>
              );
            }
            return (
              <Marker key={clusterKey} position={[coords[1], coords[0]]} icon={getClusterIcon(members.length)} zIndexOffset={200}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold" style={{ color: '#C7A76C', fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                      {members.length} personnel · same location
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                      {members.map((t) => (
                        <div key={t.userId} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#C7A76C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#0a0a0a', flexShrink: 0 }}>
                            {t.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                            {t.operationalRole && <div className="text-xs opacity-70">{t.operationalRole.replace(/_/g, ' ')}</div>}
                          </div>
                          {t.isOnline && <span style={{ marginLeft: 'auto', color: '#34d399', fontSize: '0.6rem', flexShrink: 0 }}>●</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {visibleEvents.map((ev) => { const [lng, lat] = ev.coordinates.coordinates; const cfg = EVENT_TYPE_CONFIG[ev.eventType]; return (
            <Marker key={ev._id} position={[lat, lng]} icon={getEventIconCached(ev.eventType, ev.status)} zIndexOffset={ev.status === 'ACTIVE' ? 500 : 0}><Popup><div className="text-sm"><div className="font-bold">{cfg?.label || ev.eventType}</div><div className="text-xs opacity-70">{ev.senderId?.name || 'Unknown'}{ev.senderId?.operationalRole ? ` · ${ev.senderId.operationalRole.replace(/_/g, ' ')}` : ''}</div><div className="text-xs mt-0.5 opacity-60">{ev.status}</div></div></Popup></Marker>
          ); })}
        </MapContainer>
      </div>
    </div>
  );
};

export default MobileFieldMap;

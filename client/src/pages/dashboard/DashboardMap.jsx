import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, FeatureGroup, Polygon } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { isValidCoords, safeGetCoords } from '../../utils/location';
import {
  sanitizeColor, isImageUrl, ROLE_LABEL,
  createUserMarkerIcon, createSelfMarkerIcon, createAoMarkerIcon,
  createClusterMarkerIcon, snapHeading,
  EVENT_TYPE_CONFIG, EVENT_STATUS_OPACITY, getEventIconCached,
} from '../../utils/markerUtils';
import { findAoForPoint, toLatLngs } from '../../utils/mapGeometry';
import { DEFAULT_MAP_ZOOM, DEFAULT_AO_COLOR, VIEWPORT_DEBOUNCE_MS } from '../../config/constants';
import EventClusterSpider from './EventClusterSpider';
import styles from '../Dashboard.module.scss';

const MapController = ({ center, triggerFly, userLocation }) => {
  const map = useMap();
  useEffect(() => { if (isValidCoords(center)) map.setView(center, map.getZoom()); }, [center, map]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isValidCoords(userLocation)) map.flyTo(userLocation, 16, { animate: true, duration: 0.8 }); }, [triggerFly]);
  return null;
};

const MapViewportSubscriber = ({ onViewportChange, debounceMs = VIEWPORT_DEBOUNCE_MS }) => {
  const map = useMap();
  const timerRef = useRef(null);
  const emit = useCallback(() => {
    if (!onViewportChange) return;
    const b = map.getBounds();
    onViewportChange({ minLat: b.getSouthWest().lat, minLng: b.getSouthWest().lng, maxLat: b.getNorthEast().lat, maxLng: b.getNorthEast().lng, zoom: map.getZoom() });
  }, [map, onViewportChange]);
  const schedule = useCallback(() => {
    if (!onViewportChange) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(emit, debounceMs);
  }, [debounceMs, emit, onViewportChange]);
  useMapEvents({ move: schedule, zoom: schedule });
  useEffect(() => { schedule(); return () => clearTimeout(timerRef.current); }, [schedule]);
  return null;
};

// Round coords to ~11m precision to detect co-located users
const CLUSTER_PRECISION = 4;

const DARK_LAYER = { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>' };
const SAT_BASE   = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community' };
const SAT_LABELS = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attribution: '' };

const DashboardMap = ({ center, users, userLocation, onUserClick, liveUpdateIds, onViewportChange, aos = [], onAOCreate, onAOEdit, onAODelete, onAOSelect, featureGroupRef, canManageAOs = false, getCompanyIdentity, fieldEvents = [], onEventClick, onEventRespond, respondingIds = new Set() }) => {
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [isHybrid, setIsHybrid] = useState(false);
  const iconCacheRef = useRef(new Map());

  const getCachedIcon = useCallback((key, create) => {
    if (!iconCacheRef.current.has(key)) iconCacheRef.current.set(key, create());
    return iconCacheRef.current.get(key);
  }, []);

  const getMarkerIcon = useCallback(({ point, className = '', variant = 'pin', isOnline = false, operationalRole = '', heading, speed }) => {
    const ao = findAoForPoint(point, aos);
    const identity = ao && getCompanyIdentity ? getCompanyIdentity(ao) : null;
    const color = identity?.color || DEFAULT_AO_COLOR;
    if (variant === 'dot') return getCachedIcon(`self:${className}:${color}`, () => createSelfMarkerIcon({ color, className }));
    const headingKey = (typeof heading === 'number' && Number.isFinite(heading)) ? snapHeading(heading) : 'n';
    const speedKey = (typeof speed === 'number' && speed >= 0.5) ? '1' : '0';
    return getCachedIcon(`user:${className}:${color}:${isOnline}:${operationalRole}:${headingKey}:${speedKey}`, () => createUserMarkerIcon({ color, isOnline, operationalRole, heading, speed, className }));
  }, [aos, getCompanyIdentity, getCachedIcon]);

  const aoStrokeStyles = useMemo(() => new Map(aos.map((ao) => {
    const identity = getCompanyIdentity ? getCompanyIdentity(ao) : null;
    return [ao._id, { color: identity?.color || DEFAULT_AO_COLOR, fillColor: identity?.color || DEFAULT_AO_COLOR }];
  })), [aos, getCompanyIdentity]);

  // Group co-located users (same coordinates within ~11m) into clusters
  const userGroups = useMemo(() => {
    const groups = new Map();
    for (const user of users) {
      const coords = safeGetCoords(user);
      if (!isValidCoords(coords)) continue;
      const key = `${coords[0].toFixed(CLUSTER_PRECISION)},${coords[1].toFixed(CLUSTER_PRECISION)}`;
      if (!groups.has(key)) groups.set(key, { coords, users: [] });
      groups.get(key).users.push(user);
    }
    return Array.from(groups.values());
  }, [users]);

  // Group co-located field events into clusters (same precision as user clusters)
  const eventGroups = useMemo(() => {
    const groups = new Map();
    for (const ev of fieldEvents) {
      const c = ev.coordinates?.coordinates;
      if (!Array.isArray(c) || c.length !== 2) continue;
      const [lng, lat] = c;
      const key = `${lat.toFixed(CLUSTER_PRECISION)},${lng.toFixed(CLUSTER_PRECISION)}`;
      if (!groups.has(key)) groups.set(key, { lat, lng, events: [] });
      groups.get(key).events.push(ev);
    }
    return Array.from(groups.values());
  }, [fieldEvents]);

  return (
    <div className={styles.mapComponentRoot}>
      <button onClick={() => setIsHybrid((v) => !v)} aria-label="Toggle satellite view" title={isHybrid ? 'Switch to dark map' : 'Switch to satellite view'} className={`${styles.layerToggleFab}${isHybrid ? ` ${styles.layerToggleFabActive}` : ''}`}>
        {isHybrid ? (
          /* Map/vector icon — click to go back to dark */
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
        ) : (
          /* Layers/satellite icon — click to go satellite */
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        )}
      </button>
      <button onClick={() => { if (isValidCoords(userLocation)) setFlyTrigger((n) => n + 1); }} disabled={!isValidCoords(userLocation)} aria-label="Center map on my location" title="Center on me" className={styles.locateMeFab}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
      </button>
      <MapContainer center={center} zoom={DEFAULT_MAP_ZOOM} style={{ height: '100%', width: '100%' }} className="rounded-xl" attributionControl={false}>
        {isHybrid ? (
          <>
            <TileLayer key="sat-base" url={SAT_BASE.url} attribution={SAT_BASE.attribution} maxZoom={19} />
            <TileLayer key="sat-labels" url={SAT_LABELS.url} attribution={SAT_LABELS.attribution} maxZoom={19} />
          </>
        ) : (
          <TileLayer key="dark" attribution={DARK_LAYER.attribution} url={DARK_LAYER.url} />
        )}
        <MapController center={center} triggerFly={flyTrigger} userLocation={userLocation} />
        <MapViewportSubscriber onViewportChange={onViewportChange} />
        <FeatureGroup ref={featureGroupRef}>
          {canManageAOs && <EditControl position="topright" onCreated={onAOCreate} onEdited={onAOEdit} onDeleted={onAODelete} draw={{ polygon: { allowIntersection: false, showArea: false, shapeOptions: { color: DEFAULT_AO_COLOR, weight: 2, fillOpacity: 0.2 } }, polyline: false, rectangle: false, circle: false, circlemarker: false, marker: false }} edit={{ edit: { selectedPathOptions: { color: DEFAULT_AO_COLOR, fillOpacity: 0.25 } }, remove: true }} />}
          {aos.map((ao) => (
            <Polygon key={ao._id} positions={toLatLngs(ao.polygon)} ref={(layer) => { if (layer) layer.options.aoId = ao._id; }} pathOptions={{ color: aoStrokeStyles.get(ao._id)?.color || DEFAULT_AO_COLOR, fillColor: aoStrokeStyles.get(ao._id)?.fillColor || DEFAULT_AO_COLOR, fillOpacity: ao.active ? 0.2 : 0.06, weight: ao.active ? 2 : 1, dashArray: (getCompanyIdentity && getCompanyIdentity(ao)?.pattern) || (ao.active ? null : '5,6') }} eventHandlers={{ click: () => onAOSelect?.(ao) }}>
              <Popup><div className="text-jet"><p className="font-semibold">{ao?.style?.icon && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-jet text-[10px] text-white mr-2">{isImageUrl(ao.style.icon) ? <img src={ao.style.icon} alt="" className="h-3 w-3" /> : ao.style.icon}</span>}{ao.name}</p><p className="text-xs text-gray-600">{ao.active ? 'Active' : 'Inactive'}</p></div></Popup>
            </Polygon>
          ))}
        </FeatureGroup>
        {isValidCoords(userLocation) && (
          <Marker position={userLocation} icon={getMarkerIcon({ point: [userLocation[1], userLocation[0]], variant: 'dot' })}>
            <Popup className="marker-popup-dark"><div className="map-popup"><div className="map-popup-header"><span className="map-popup-avatar self"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span><div><p className="map-popup-name">You</p><p className="map-popup-sub">{userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}</p></div></div><span className="map-popup-badge online">● LIVE</span></div></Popup>
          </Marker>
        )}
        {userGroups.map(({ coords, users: grp }) => {
          if (grp.length === 1) {
            const user = grp[0];
            return (
              <Marker key={user._id} position={[coords[1], coords[0]]} icon={getMarkerIcon({ point: coords, className: liveUpdateIds.has(user._id) ? 'marker-live-update' : '', variant: 'pin', isOnline: Boolean(user.isOnline || user.online), operationalRole: user.operationalRole || '', heading: user.heading, speed: user.speed })} eventHandlers={{ click: () => onUserClick(user) }}>
                <Popup className="marker-popup-dark"><div className="map-popup"><div className="map-popup-header"><span className="map-popup-avatar">{user.name?.charAt(0)?.toUpperCase() || '?'}</span><div><p className="map-popup-name">{user.name}</p>{user.operationalRole && <p className="map-popup-role">{ROLE_LABEL[user.operationalRole] || user.operationalRole}</p>}<p className="map-popup-sub">{user.email}</p></div></div><div className="map-popup-footer"><span className={`map-popup-badge ${(user.isOnline || user.online) ? 'online' : 'offline'}`}>{(user.isOnline || user.online) ? '● ONLINE' : '○ OFFLINE'}</span>{user.distance && <span className="map-popup-dist">{user.distance} km away</span>}</div></div></Popup>
              </Marker>
            );
          }
          // Cluster: 2+ users at the same location
          const ao = findAoForPoint(coords, aos);
          const identity = ao && getCompanyIdentity ? getCompanyIdentity(ao) : null;
          const clusterColor = identity?.color || DEFAULT_AO_COLOR;
          const clusterKey = `cluster:${coords[0].toFixed(CLUSTER_PRECISION)},${coords[1].toFixed(CLUSTER_PRECISION)}`;
          const clusterIcon = getCachedIcon(`cluster:${clusterColor}:${grp.length}`, () => createClusterMarkerIcon({ color: clusterColor, count: grp.length }));
          return (
            <Marker key={clusterKey} position={[coords[1], coords[0]]} icon={clusterIcon} zIndexOffset={200}>
              <Popup className="marker-popup-dark" minWidth={200}>
                <div className="map-popup">
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#C7A76C', letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' }}>
                    {grp.length} personnel · same location
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '210px', overflowY: 'auto' }}>
                    {grp.map((u) => (
                      <div
                        key={u._id}
                        onClick={() => onUserClick(u)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '5px 7px', borderRadius: '6px', background: 'rgba(199,167,108,0.07)', border: '1px solid rgba(199,167,108,0.15)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(199,167,108,0.16)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(199,167,108,0.07)'; }}
                      >
                        <span className="map-popup-avatar" style={{ flexShrink: 0, width: 28, height: 28, fontSize: '0.75rem' }}>{u.name?.charAt(0)?.toUpperCase() || '?'}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p className="map-popup-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                          {u.operationalRole && <p className="map-popup-role">{ROLE_LABEL[u.operationalRole] || u.operationalRole}</p>}
                        </div>
                        <span className={`map-popup-badge ${(u.isOnline || u.online) ? 'online' : 'offline'}`} style={{ flexShrink: 0, fontSize: '0.6rem' }}>
                          {(u.isOnline || u.online) ? '●' : '○'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        {eventGroups.map(({ lat, lng, events: grp }) => {
          const position = [lat, lng];
          if (grp.length === 1) {
            const ev = grp[0];
            const cfg = EVENT_TYPE_CONFIG[ev.eventType] || { color: '#6b7280', label: ev.eventType, glyph: '?' };
            return (
              <Marker key={ev._id} position={position} icon={getCachedIcon(`event:${ev.eventType}:${ev.status}`, () => getEventIconCached(ev.eventType, ev.status))} eventHandlers={{ click: () => onEventClick?.(ev) }} zIndexOffset={ev.status === 'ACTIVE' ? 500 : 0}>
                <Popup className="marker-popup-dark"><div className="map-popup"><div className="map-popup-header"><span className="map-popup-avatar" style={{ backgroundColor: cfg.color, fontSize: '0.75rem', fontWeight: 700 }}>{cfg.glyph}</span><div><p className="map-popup-name">{cfg.label}</p><p className="map-popup-sub">{new Date(ev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div></div><div className="map-popup-footer"><span className={`map-popup-badge ${ev.status === 'ACTIVE' ? 'online' : 'offline'}`}>{ev.status}</span><span className="map-popup-dist">{lat.toFixed(5)}, {lng.toFixed(5)}</span></div></div></Popup>
              </Marker>
            );
          }
          return (
            <EventClusterSpider
              key={`evcluster:${lat.toFixed(CLUSTER_PRECISION)},${lng.toFixed(CLUSTER_PRECISION)}`}
              events={grp}
              position={position}
              onRespond={onEventRespond}
              respondingIds={respondingIds}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};

export default DashboardMap;

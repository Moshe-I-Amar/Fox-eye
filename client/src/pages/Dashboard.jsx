import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, FeatureGroup, Polygon } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { Icon } from 'leaflet';
import { userService } from '../services/usersApi';
import { aoService } from '../services/aoApi';
import socketService from '../services/socketService';
import { authService } from '../services/authApi';
import { isValidCoords, safeGetCoords } from '../utils/location';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Navbar from '../components/layout/Navbar';

const MapController = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!isValidCoords(center)) {
      return;
    }
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
};

const MapViewportSubscriber = ({ onViewportChange, debounceMs = 250 }) => {
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

const DEFAULT_AO_COLOR = '#C7A76C';
const DEFAULT_AO_ICON = '';
const AO_ICON_MAX_LENGTH = 6;
const AO_NAME_MIN = 2;
const AO_NAME_MAX = 100;
const AO_ICON_PRESETS = [
  '🛰️', '📡', '🛡️', '⚡', '🧭', '📍', '🚨', '🔭',
  '🧯', '🩺', '🚑', '🚒', '⛑️', '🛠️', '⚙️', '📦',
  '🧱', '🚧', '🛰', '🗺️', '🔒', '✅', '⚠️', '⭐'
];
const AO_PRESET_OPTIONS = [
  { label: 'Ops Command', icon: '🛰️', color: '#C7A76C' },
  { label: 'Medical', icon: '🩺', color: '#6DD3CE' },
  { label: 'Fire', icon: '🚒', color: '#FF6B6B' },
  { label: 'Search', icon: '🔭', color: '#7BD389' },
  { label: 'Security', icon: '🛡️', color: '#4C6EF5' },
  { label: 'Hazard', icon: '⚠️', color: '#F4C542' },
  { label: 'Engineering', icon: '🛠️', color: '#9C7AFA' },
  { label: 'Logistics', icon: '📦', color: '#FFA94D' }
];

const escapeXml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isImageUrl = (value = '') => /^(data:image|https?:\/\/|\/|blob:)/i.test(value.trim());
const isValidIconValue = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (isImageUrl(trimmed)) return true;
  return trimmed.length <= AO_ICON_MAX_LENGTH;
};

const svgToDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const buildPinSvg = ({ color, icon, iconUrl }) => {
  const iconMarkup = iconUrl
    ? `<image href="${iconUrl}" x="7" y="5" width="10" height="10" />`
    : icon
      ? `<text x="12" y="11" text-anchor="middle" dominant-baseline="middle" font-size="6" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif">${escapeXml(icon)}</text>`
      : `<circle cx="12" cy="10" r="2.5" fill="#ffffff" />`;

  return `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8 13 2 20 2 20C2 20 12 20 20 20C20 20 16 13 12 2Z" fill="${color}" />
      <circle cx="12" cy="10" r="4.5" fill="rgba(0,0,0,0.35)" />
      ${iconMarkup}
    </svg>
  `.trim();
};

const buildDotSvg = ({ color, icon, iconUrl }) => {
  const iconMarkup = iconUrl
    ? `<image href="${iconUrl}" x="10" y="10" width="12" height="12" />`
    : icon
      ? `<text x="16" y="16" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif">${escapeXml(icon)}</text>`
      : `<circle cx="16" cy="16" r="3" fill="#0a0a0a" />`;

  return `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="10" fill="${color}" fill-opacity="0.25" />
      <circle cx="16" cy="16" r="5" fill="${color}" />
      ${iconMarkup}
    </svg>
  `.trim();
};

const createAoMarkerIcon = ({ color, icon, className = '', variant = 'pin' }) => {
  const safeColor = color || DEFAULT_AO_COLOR;
  const trimmedIcon = `${icon || DEFAULT_AO_ICON}`.trim();
  const iconUrl = trimmedIcon && isImageUrl(trimmedIcon) ? trimmedIcon : '';
  const iconText = iconUrl ? '' : trimmedIcon;
  const svg = variant === 'dot'
    ? buildDotSvg({ color: safeColor, icon: iconText, iconUrl })
    : buildPinSvg({ color: safeColor, icon: iconText, iconUrl });

  return new Icon({
    iconUrl: svgToDataUrl(svg),
    iconSize: [32, 32],
    iconAnchor: variant === 'dot' ? [16, 16] : [16, 32],
    popupAnchor: variant === 'dot' ? [0, -16] : [0, -32],
    className
  });
};

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
  onAOSelect,
  featureGroupRef,
  canManageAOs = false
}) => {
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
    ({ point, className = '', variant = 'pin' }) => {
      const ao = getAoForPoint(point);
      const color = ao?.style?.color || DEFAULT_AO_COLOR;
      const icon = ao?.style?.icon || DEFAULT_AO_ICON;
      const cacheKey = `${variant}:${className}:${color}:${icon}`;
      return getCachedIcon(cacheKey, () =>
        createAoMarkerIcon({
          color,
          icon,
          className,
          variant
        })
      );
    },
    [getAoForPoint, getCachedIcon]
  );

  const aoStrokeStyles = useMemo(
    () =>
      new Map(
        aos.map((ao) => [
          ao._id,
          {
            color: ao?.style?.color || DEFAULT_AO_COLOR,
            fillColor: ao?.style?.color || DEFAULT_AO_COLOR
          }
        ])
      ),
    [aos]
  );

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      <MapController center={center} />
      <MapViewportSubscriber onViewportChange={onViewportChange} />

      <FeatureGroup ref={featureGroupRef}>
        {canManageAOs && (
          <EditControl
            position="topright"
            onCreated={onAOCreate}
            onEdited={onAOEdit}
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
              remove: false
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
              dashArray: ao.active ? null : '5,6'
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
      
      {/* User's current location marker */}
      {isValidCoords(userLocation) && (
        <Marker
          position={userLocation}
          icon={getMarkerIcon({
            point: [userLocation[1], userLocation[0]],
            variant: 'dot'
          })}
        >
          <Popup>
            <div className="text-jet">
              <p className="font-semibold text-blue-600">Your Location</p>
              <p className="text-sm text-gray-600">
                {userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
      
      {users
        .map((user) => ({ user, coords: safeGetCoords(user) }))
        .filter(({ coords }) => isValidCoords(coords))
        .map(({ user, coords }) => (
          <Marker
            key={user._id}
            position={[coords[1], coords[0]]}
            icon={
              getMarkerIcon({
                point: coords,
                className: liveUpdateIds.has(user._id) ? 'marker-live-update' : '',
                variant: 'pin'
              })
            }
            eventHandlers={{
              click: () => onUserClick(user)
            }}
          >
            <Popup>
              <div className="text-jet">
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
                <p className={`text-xs ${user.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                  {user.isOnline ? 'Online' : 'Offline'}
                </p>
                {user.distance && (
                  <p className="text-xs text-gray-500">{user.distance} km away</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
};

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLocation, setUserLocation] = useState([40.7128, -74.0060]); // Default: NYC
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]);
  const [radius, setRadius] = useState(10);
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
  const [viewportBounds, setViewportBounds] = useState(null);
  const [aos, setAos] = useState([]);
  const [aoLoading, setAoLoading] = useState(false);
  const [aoError, setAoError] = useState('');
  const [aoDraft, setAoDraft] = useState(null);
  const [aoModalMode, setAoModalMode] = useState('create');
  const [aoForm, setAoForm] = useState({ name: '', color: DEFAULT_AO_COLOR, icon: '' });
  const [aoIconError, setAoIconError] = useState('');
  const [aoNameError, setAoNameError] = useState('');
  const [selectedAO, setSelectedAO] = useState(null);
  const [aoSaving, setAoSaving] = useState(false);
  const featureGroupRef = useRef(null);
  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?.id || currentUser?._id;
  const canManageAOs = currentUser?.role === 'admin' || currentUser?.operationalRole === 'COMPANY_COMMANDER';
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

    const handleAuthError = () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('error');
      setRealtimeNotice('Session expired. Redirecting to login...');
      authService.logout();
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
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await socketService.connect(token);
          setRealtimeEnabled(true);
          setRealtimeStatus('connected');
          
          // Subscribe to presence updates
          socketService.subscribeToPresence();
          
          console.log('Socket connected and authenticated');
        } catch (error) {
          const message = `${error?.message || ''}`.toLowerCase();
          if (message.includes('authentication error') || message.includes('token expired') || message.includes('invalid token')) {
            return;
          }
          console.error('Failed to connect socket:', error);
          setRealtimeEnabled(false);
          setRealtimeStatus('offline');
        }
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
      console.log('Received location update:', data);

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
      console.error('Socket error:', error);
    };

    socketService.on('location:update', handleLocationUpdate);
    socketService.on('presence:update', handlePresenceUpdate);
    socketService.on('error', handleSocketError);

    return () => {
      socketService.off('location:update', handleLocationUpdate);
      socketService.off('presence:update', handlePresenceUpdate);
      socketService.off('error', handleSocketError);
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
        } else {
          const response = await userService.getUsersNearby(center[0], center[1], radius);
          setUsers(response.users.map(user => ({
            ...user,
            lastUpdateAt: user.lastUpdateAt || user.lastSeen || user.updatedAt
          })));
        }
      } catch (error) {
        console.error('Error fetching nearby users:', error);
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

  const fetchAOs = async () => {
    try {
      setAoLoading(true);
      setAoError('');
      const params = {};
      if (currentUser?.role === 'admin' && currentUser?.companyId) {
        params.companyId = currentUser.companyId;
      }
      const response = await aoService.getAOs(params);
      setAos(response?.data?.aos || []);
    } catch (error) {
      console.error('Error fetching AOs:', error);
      setAoError('Failed to load area overlays. Please try again.');
    } finally {
      setAoLoading(false);
    }
  };

  useEffect(() => {
    fetchAOs();
  }, []);

  const clearDraftLayer = () => {
    if (featureGroupRef.current && aoDraft?.layer) {
      featureGroupRef.current.removeLayer(aoDraft.layer);
    }
  };

  const handleAOCreate = (event) => {
    if (!event?.layer) {
      return;
    }

    const polygon = toGeoPolygon(event.layer.getLatLngs());
    if (!polygon) {
      return;
    }

    setAoDraft({
      polygon,
      layer: event.layer
    });
    setAoForm({ name: '', color: DEFAULT_AO_COLOR, icon: '' });
    setAoIconError('');
    setAoNameError('');
    setAoModalMode('create');
    setAoError('');
  };

  const handleAOEdit = async (event) => {
    if (!event?.layers) {
      return;
    }

    const updates = [];
    event.layers.eachLayer((layer) => {
      const aoId = layer?.options?.aoId;
      const polygon = toGeoPolygon(layer.getLatLngs());
      if (aoId && polygon) {
        updates.push({ aoId, polygon });
      }
    });

    if (!updates.length) {
      return;
    }

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
      console.error('Error updating AO geometry:', error);
      setAoError('Failed to update AO geometry. Please try again.');
    } finally {
      setAoSaving(false);
    }
  };

  const handleAOSelect = (ao) => {
    if (!canManageAOs) {
      return;
    }
    setSelectedAO(ao);
    setAoForm({
      name: ao.name || '',
      color: ao.style?.color || DEFAULT_AO_COLOR,
      icon: ao.style?.icon || ''
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
    setAoForm({ name: '', color: DEFAULT_AO_COLOR, icon: '' });
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

    try {
      setAoSaving(true);
      setAoError('');

      if (aoModalMode === 'create') {
        if (!aoDraft?.polygon) {
          return;
        }

        if (!currentUser?.companyId) {
          setAoError('Company assignment is required to save this AO.');
          return;
        }

        const payload = {
          name: trimmedName,
          polygon: aoDraft.polygon,
          style: { color: aoForm.color, icon: trimmedIcon || null },
          companyId: currentUser.companyId
        };

        const response = await aoService.createAO(payload);
        const createdAO = response?.data?.ao;
        if (createdAO) {
          setAos((prev) => [createdAO, ...prev]);
        }
        clearDraftLayer();
        setAoDraft(null);
      } else if (selectedAO) {
        const response = await aoService.updateAO(selectedAO._id, {
          name: trimmedName,
          style: { color: aoForm.color, icon: trimmedIcon || null }
        });
        const updatedAO = response?.data?.ao;
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
      console.error('Error saving AO:', error);
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
      console.error('Error updating AO status:', error);
      setAoError('Failed to update AO status. Please try again.');
    }
  };

  const isAoModalOpen = (aoModalMode === 'create' && !!aoDraft) || (aoModalMode === 'edit' && !!selectedAO);

  // Listen for socket location responses
  useEffect(() => {
    if (!realtimeEnabled) return;

    const handleLocationResponse = (data) => {
      console.log('Received location response:', data);
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
        } else {
          await userService.updateMyLocation([longitude, latitude]);
        }
      } catch (error) {
        console.error('Error updating location:', error);
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

  const handleViewportChange = useCallback((viewport) => {
    setViewportBounds(viewport);
  }, []);

  const renderAoLegendIcon = (ao) => {
    const color = ao?.style?.color || DEFAULT_AO_COLOR;
    const icon = `${ao?.style?.icon || ''}`.trim();
    const hasImage = icon && isImageUrl(icon);

    return (
      <span
        className="h-6 w-6 rounded-full border border-white/10 flex items-center justify-center text-[10px] text-white"
        style={{ backgroundColor: color }}
      >
        {hasImage ? (
          <img src={icon} alt="" className="h-3.5 w-3.5" />
        ) : (
          icon
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar realtimeStatus={realtimeStatus} />

      {realtimeNotice && (
        <div className="px-6 pt-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              realtimeNoticeTone === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-gold/30 bg-gold/10 text-gold/80'
            }`}
          >
            {realtimeNotice}
          </div>
        </div>
      )}
      
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - User List */}
        <div className="w-80 glass-card border-r border-gold/20 p-6 overflow-hidden flex flex-col">
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
                  <div className="text-xs text-gold/50">No overlays yet. Draw one on the map.</div>
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
        <div className="flex-1 p-6">
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
              onAOSelect={handleAOSelect}
              featureGroupRef={featureGroupRef}
              canManageAOs={canManageAOs}
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
            <label className="text-sm text-gold">Presets</label>
            <select
              className="dark-input w-full"
              value=""
              onChange={(event) => {
                const selected = AO_PRESET_OPTIONS.find((preset) => preset.label === event.target.value);
                if (!selected) return;
                setAoForm((prev) => ({
                  ...prev,
                  name: prev.name || selected.label,
                  color: selected.color,
                  icon: selected.icon
                }));
                setAoIconError('');
                setAoNameError('');
              }}
            >
              <option value="" disabled>Select a preset</option>
              {AO_PRESET_OPTIONS.map((preset) => (
                <option key={preset.label} value={preset.label}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gold">Overlay Color</label>
            <input
              type="color"
              value={aoForm.color}
              onChange={(event) => setAoForm((prev) => ({ ...prev, color: event.target.value }))}
              className="h-10 w-20 rounded border border-gold/30 bg-transparent"
            />
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
                placeholder="e.g. 🛰️ or /icons/ao.png"
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
              />
            </div>
            <p className="text-xs text-gold/60">
              Use a short label/emoji or an image URL/path for the AO icon.
            </p>
            {aoIconError && <p className="text-xs text-red-400">{aoIconError}</p>}
            <div className="grid grid-cols-8 gap-2 pt-2">
              {AO_ICON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`h-8 w-8 rounded-lg border text-sm ${
                    aoForm.icon === preset
                      ? 'border-gold bg-gold/15'
                      : 'border-gold/20 hover:border-gold/60'
                  }`}
                  onClick={() => {
                    setAoForm((prev) => ({ ...prev, icon: preset }));
                    setAoIconError('');
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
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
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;

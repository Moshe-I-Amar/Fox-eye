import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, FeatureGroup, Polygon } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { Icon } from 'leaflet';
import { userService } from '../services/usersApi';
import { aoService } from '../services/aoApi';
import socketClient from '../realtime/socketClient';
import { authService } from '../services/authApi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Navbar from '../components/layout/Navbar';

const MapController = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
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

  const customIcon = new Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOCAxMyAyIDIwIDIgMjBDMiAyMCAxMiAyMCAyMCAyMEMyMCAyMCAxNiAxMyAxMiAyWiIgZmlsbD0iI0M3QTc2QyIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIiBmaWxsPSIjMEEwQTAwIi8+Cjwvc3ZnPg==',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  const userIcon = new Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iOCIgZmlsbD0iIzAwRkZGRiIgZmlsbC1vcGFjaXR5PSIwLjMiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iNCIgZmlsbD0iIzAwRkZGRiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIyIiBmaWxsPSIjMDAwMDAwIi8+Cjwvc3ZnPg==',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });

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
                showArea: true,
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
              color: ao.style?.color || DEFAULT_AO_COLOR,
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
                <p className="font-semibold">{ao.name}</p>
                <p className="text-xs text-gray-600">
                  {ao.active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </Popup>
          </Polygon>
        ))}
      </FeatureGroup>
      
      {/* User's current location marker */}
      {userLocation && (
        <Marker
          position={userLocation}
          icon={userIcon}
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
      
      {users.map((user) => (
        <Marker
          key={user._id}
          position={[user.location.coordinates[1], user.location.coordinates[0]]}
          icon={
            liveUpdateIds.has(user._id)
              ? new Icon({
                  ...customIcon.options,
                  className: 'marker-live-update'
                })
              : customIcon
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
  const [viewportBounds, setViewportBounds] = useState(null);
  const [aos, setAos] = useState([]);
  const [aoLoading, setAoLoading] = useState(false);
  const [aoError, setAoError] = useState('');
  const [aoDraft, setAoDraft] = useState(null);
  const [aoModalMode, setAoModalMode] = useState('create');
  const [aoForm, setAoForm] = useState({ name: '', color: DEFAULT_AO_COLOR });
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

    socketClient.on('connect', handleConnect);
    socketClient.on('disconnect', handleDisconnect);
    socketClient.on('reconnecting', handleReconnect);
    socketClient.on('connect_error', handleConnectError);
    socketClient.on('reconnect_failed', handleReconnectFailed);
    socketClient.on('auth_error', handleAuthError);

    const initSocket = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await socketClient.connect(token);
          setRealtimeEnabled(true);
          setRealtimeStatus('connected');
          
          // Subscribe to presence updates
          socketClient.subscribeToPresence();
          
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
      socketClient.off('connect', handleConnect);
      socketClient.off('disconnect', handleDisconnect);
      socketClient.off('reconnecting', handleReconnect);
      socketClient.off('connect_error', handleConnectError);
      socketClient.off('reconnect_failed', handleReconnectFailed);
      socketClient.off('auth_error', handleAuthError);
      socketClient.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    return () => {
      liveUpdateTimers.current.forEach((timer) => clearTimeout(timer));
      liveUpdateTimers.current.clear();
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

      if (!data?.coordinates || data.coordinates.length !== 2) {
        return;
      }

      const [longitude, latitude] = data.coordinates;

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
              mapCenter,
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
              distance: calculateDistance(mapCenter, [latitude, longitude]),
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

    socketClient.on('location:update', handleLocationUpdate);
    socketClient.on('presence:update', handlePresenceUpdate);
    socketClient.on('error', handleSocketError);

    return () => {
      socketClient.off('location:update', handleLocationUpdate);
      socketClient.off('presence:update', handlePresenceUpdate);
      socketClient.off('error', handleSocketError);
    };
  }, [realtimeEnabled, mapCenter, radius, currentUserId]);

  useEffect(() => {
    if (!realtimeEnabled || !viewportBounds) {
      return;
    }
    if (!socketClient.isSocketConnected()) {
      return;
    }
    socketClient.subscribeToViewport(viewportBounds);
  }, [realtimeEnabled, viewportBounds]);

  // Initial data fetch
  useEffect(() => {
    fetchNearbyUsers();
  }, [mapCenter, radius]);


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

  const fetchNearbyUsers = async () => {
    try {
      setLoading(true);
      
      // Use socket for real-time data if available, otherwise fall back to HTTP
      if (realtimeEnabled && socketClient.isSocketConnected()) {
        socketClient.requestLocation(mapCenter, radius, true);
      } else {
        const response = await userService.getUsersNearby(mapCenter[0], mapCenter[1], radius);
        setUsers(response.data.users.map(user => ({
          ...user,
          lastUpdateAt: user.lastUpdateAt || user.lastSeen || user.updatedAt
        })));
      }
    } catch (error) {
      console.error('Error fetching nearby users:', error);
    } finally {
      setLoading(false);
    }
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
    setAoForm({ name: '', color: DEFAULT_AO_COLOR });
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
      color: ao.style?.color || DEFAULT_AO_COLOR
    });
    setAoModalMode('edit');
    setAoError('');
  };

  const handleAOCancel = () => {
    clearDraftLayer();
    setAoDraft(null);
    setSelectedAO(null);
    setAoForm({ name: '', color: DEFAULT_AO_COLOR });
  };

  const handleAOSubmit = async () => {
    const trimmedName = aoForm.name.trim();
    if (trimmedName.length < 2) {
      setAoError('AO name must be at least 2 characters.');
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
          style: { color: aoForm.color }
        };
        if (currentUser?.role === 'admin' && currentUser?.companyId) {
          payload.companyId = currentUser.companyId;
        }

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
          style: { color: aoForm.color }
        });
        const updatedAO = response?.data?.ao;
        if (updatedAO) {
          setAos((prev) => prev.map((ao) => (ao._id === updatedAO._id ? updatedAO : ao)));
        } else {
          setAos((prev) =>
            prev.map((ao) =>
              ao._id === selectedAO._id
                ? { ...ao, name: trimmedName, style: { ...ao.style, color: aoForm.color } }
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

    socketClient.on('location:response', handleLocationResponse);

    return () => {
      socketClient.off('location:response', handleLocationResponse);
    };
  }, [realtimeEnabled, onlineUsers]);

  const handleUseMyLocation = () => {
    setLocationLoading(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = [latitude, longitude];
        setUserLocation(newLocation);
        setMapCenter(newLocation);
        
        try {
          // Update location via socket if available, otherwise HTTP
          if (realtimeEnabled && socketClient.isSocketConnected()) {
            socketClient.updateLocation([longitude, latitude]);
            console.log('Location updated via socket');
          } else {
            await userService.updateMyLocation([longitude, latitude]);
            console.log('Location updated via HTTP');
          }
        } catch (error) {
          console.error('Error updating location:', error);
          setLocationError('Failed to update location. Please try again.');
        }
        
        setLocationLoading(false);
      },
      (error) => {
        setLocationError('Unable to retrieve your location. Please enable location services.');
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000 // 10 minutes
      }
    );
  };

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
              <Button
                onClick={handleUseMyLocation}
                disabled={locationLoading}
                className="w-full"
                variant="outline"
              >
                {locationLoading ? 'Getting Location...' : 'Use My Location'}
              </Button>
              
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
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: ao.style?.color || DEFAULT_AO_COLOR }}
                        />
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
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gold">AO Name</label>
            <input
              className="dark-input w-full"
              type="text"
              placeholder="e.g. North Sector"
              value={aoForm.name}
              onChange={(event) => setAoForm((prev) => ({ ...prev, name: event.target.value }))}
            />
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
          <div className="flex items-center justify-end space-x-2">
            <Button variant="ghost" onClick={handleAOCancel}>
              Cancel
            </Button>
            <Button onClick={handleAOSubmit} disabled={aoSaving}>
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
              <p className="text-gold text-sm">
                Lat: {selectedUser.location.coordinates[1].toFixed(6)}
              </p>
              <p className="text-gold text-sm">
                Lng: {selectedUser.location.coordinates[0].toFixed(6)}
              </p>
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

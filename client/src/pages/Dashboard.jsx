import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import { userService } from '../services/usersApi';
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

const MapComponent = ({ center, users, userLocation, onUserClick, liveUpdateIds, onViewportChange }) => {
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
  const [liveUpdateIds, setLiveUpdateIds] = useState(new Set());
  const liveUpdateTimers = useRef(new Map());
  const [viewportBounds, setViewportBounds] = useState(null);
  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?.id || currentUser?._id;

  // Initialize socket connection
  useEffect(() => {
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
          console.error('Failed to connect socket:', error);
          setRealtimeEnabled(false);
          setRealtimeStatus('offline');
        }
      }
    };

    initSocket();

    return () => {
      socketClient.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      setRealtimeStatus('connected');
    };

    const handleDisconnect = () => {
      setRealtimeStatus('reconnecting');
    };

    const handleReconnect = () => {
      setRealtimeStatus('reconnecting');
    };

    socketClient.on('connect', handleConnect);
    socketClient.on('disconnect', handleDisconnect);
    socketClient.on('reconnecting', handleReconnect);
    socketClient.on('connect_error', handleDisconnect);

    return () => {
      socketClient.off('connect', handleConnect);
      socketClient.off('disconnect', handleDisconnect);
      socketClient.off('reconnecting', handleReconnect);
      socketClient.off('connect_error', handleDisconnect);
    };
  }, []);

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
            />
          </Card>
        </div>
      </div>

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

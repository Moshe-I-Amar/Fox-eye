import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../../services/socketService';
import MobileLayout    from './MobileLayout';
import PanicPanel      from './PanicPanel';
import MobileFieldMap  from './MobileFieldMap';
import MobileEventFeed from './MobileEventFeed';

/**
 * MobileFieldView — root page for the field mobile interface.
 *
 * Manages: socket connection, GPS watching, connection/GPS status.
 * Passes status down to MobileLayout (header indicators) and PanicPanel (GPS warning).
 *
 * Route: /mobile  (requires role=user via RouteGuard in App.jsx)
 */
const MobileFieldView = () => {
  const navigate = useNavigate();

  const [activeTab,         setActiveTab]         = useState('panic');
  const [userCoords,        setUserCoords]         = useState(null);
  const [connectionStatus,  setConnectionStatus]  = useState('disconnected');
  const [gpsStatus,         setGpsStatus]         = useState('searching');

  // ── Socket connection ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    socketService.connect(token, { sessionType: 'MOBILE' })
      .then(() => setConnectionStatus('connected'))
      .catch(() => setConnectionStatus('disconnected'));

    const onConnect       = () => setConnectionStatus('connected');
    const onDisconnect    = () => setConnectionStatus('disconnected');
    const onReconnecting  = () => setConnectionStatus('reconnecting');
    const onAuthError     = () => navigate('/login?reason=session-expired');
    const onReconnFailed  = () => setConnectionStatus('disconnected');

    socketService.on('connect',          onConnect);
    socketService.on('disconnect',       onDisconnect);
    socketService.on('reconnecting',     onReconnecting);
    socketService.on('auth_error',       onAuthError);
    socketService.on('reconnect_failed', onReconnFailed);

    return () => {
      socketService.off('connect',          onConnect);
      socketService.off('disconnect',       onDisconnect);
      socketService.off('reconnecting',     onReconnecting);
      socketService.off('auth_error',       onAuthError);
      socketService.off('reconnect_failed', onReconnFailed);
    };
  }, [navigate]);

  // ── GPS watcher ────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    setGpsStatus('searching');

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        setUserCoords(coords);
        setGpsStatus('locked');
        try {
          socketService.updateLocation(coords);
        } catch (_) {}
      },
      (err) => {
        console.warn('GPS error:', err.message);
        setGpsStatus(err.code === 1 ? 'unavailable' : 'searching');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleBack = useCallback(() => navigate('/dashboard'), [navigate]);

  const isPanelDisabled = connectionStatus === 'disconnected';

  return (
    <MobileLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      connectionStatus={connectionStatus}
      gpsStatus={gpsStatus}
      onBack={handleBack}
    >
      {activeTab === 'panic' && (
        <PanicPanel
          userCoordinates={userCoords}
          disabled={isPanelDisabled}
        />
      )}
      {activeTab === 'map' && (
        <MobileFieldMap
          userCoordinates={userCoords}
          showZoomControl={window.innerWidth >= 768}
        />
      )}
      {activeTab === 'feed' && (
        <MobileEventFeed limit={25} />
      )}
    </MobileLayout>
  );
};

export default MobileFieldView;

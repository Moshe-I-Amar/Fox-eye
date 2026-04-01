import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../../services/socketService';
import useOfflineQueue   from '../../hooks/useOfflineQueue';
import MobileLayout    from './MobileLayout';
import PanicPanel      from './PanicPanel';
import MobileFieldMap  from './MobileFieldMap';
import MobileEventFeed from './MobileEventFeed';

/**
 * MobileFieldView — root page for the field mobile interface.
 *
 * Manages: socket connection, GPS watching, wake lock, network status,
 * offline event queue, connection/GPS status indicators.
 *
 * Layout: MobileFieldMap is always the full-screen base layer (passed as
 * `mapSlot`). PanicPanel and MobileEventFeed render as bottom-sheet children
 * that slide up over the map — identical to the Google Maps mobile pattern.
 *
 * Route: /mobile  (requires role=user via RouteGuard in App.jsx)
 */
const MobileFieldView = () => {
  const navigate = useNavigate();

  const [activeTab,         setActiveTab]         = useState('map');
  const [userCoords,        setUserCoords]         = useState(null);
  const [connectionStatus,  setConnectionStatus]  = useState('disconnected');
  const [gpsStatus,         setGpsStatus]         = useState('searching');
  const [wakeLockStatus,    setWakeLockStatus]    = useState('unsupported');

  const wakeLockRef = useRef(null);
  const { queue, enqueue, flush } = useOfflineQueue();

  // ── Wake Lock ──────────────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockStatus('active');
      wakeLockRef.current.addEventListener('release', () => setWakeLockStatus('released'));
    } catch (_) {
      setWakeLockStatus('released');
    }
  }, []);

  useEffect(() => {
    acquireWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [acquireWakeLock]);

  // ── Network status ─────────────────────────────────────────────────
  useEffect(() => {
    const handleOffline = () => setConnectionStatus('disconnected');
    const handleOnline  = () => flush();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online',  handleOnline);
    };
  }, [flush]);

  // ── Socket connection ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    socketService.connect(token, { sessionType: 'MOBILE' })
      .then(() => setConnectionStatus('connected'))
      .catch(() => setConnectionStatus('disconnected'));

    const onConnect       = () => { setConnectionStatus('connected'); flush(); };
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
  }, [navigate, flush]);

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
        try { socketService.updateLocation(coords); } catch (_) {}
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

  // Panic buttons are never disabled by socket state — events go via REST API
  // and the offline queue handles network failures gracefully.
  const isPanelDisabled = false;

  return (
    <MobileLayout
      mapSlot={
        <MobileFieldMap
          userCoordinates={userCoords}
          showZoomControl={window.innerWidth >= 768}
          gpsStatus={gpsStatus}
        />
      }
      activeTab={activeTab}
      onTabChange={setActiveTab}
      connectionStatus={connectionStatus}
      gpsStatus={gpsStatus}
      wakeLockStatus={wakeLockStatus}
      onBack={handleBack}
    >
      {activeTab === 'panic' && (
        <PanicPanel
          userCoordinates={userCoords}
          disabled={isPanelDisabled}
          onQueueEvent={enqueue}
          queuedCount={queue.length}
        />
      )}
      {activeTab === 'feed' && (
        <MobileEventFeed limit={25} />
      )}
    </MobileLayout>
  );
};

export default MobileFieldView;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../../services/socketService';
import useOfflineQueue from '../../hooks/useOfflineQueue';
import useFieldEvents  from '../../hooks/useFieldEvents';
import useAOs          from '../../hooks/useAOs';
import useViolations   from '../../hooks/useViolations';
import { useAuth }     from '../../context/AuthContext';
import MobileLayout    from './MobileLayout';
import MobileFieldMap  from './MobileFieldMap';
import MobileEventFeed from './MobileEventFeed';
import NotificationPrompt from '../../components/ui/NotificationPrompt';

const MobileFieldView = () => {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [userCoords,     setUserCoords]     = useState(null);
  const [socketStatus,   setSocketStatus]   = useState('disconnected');
  const [gpsStatus,      setGpsStatus]      = useState('searching');
  const [wakeLockStatus, setWakeLockStatus] = useState('unsupported');
  const [mapFocusCoords, setMapFocusCoords] = useState(null);
  const wakeLockRef = useRef(null);

  const { queue, enqueue, flush }                                          = useOfflineQueue();
  const { events, loading: eventsLoading, error: eventsError,
          refetch: refetchEvents, updateEvent }                            = useFieldEvents(25);
  const { error: aoError, refetch: fetchAOs }                             = useAOs();
  const { violations }                                                     = useViolations(true, {}, 10);

  useEffect(() => { fetchAOs(); }, [fetchAOs]);

  const connectionStatus = useMemo(() => {
    if (socketStatus === 'disconnected') return 'disconnected';
    if (socketStatus === 'reconnecting' || aoError) return 'reconnecting';
    return 'connected';
  }, [socketStatus, aoError]);

  const activeViolationCount = useMemo(
    () => violations.filter((v) => v.type === 'BREACH' || v.type === 'SUSTAINED_BREACH').length,
    [violations]
  );

  // Wake lock
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockStatus('active');
      wakeLockRef.current.addEventListener('release', () => setWakeLockStatus('released'));
    } catch (_) { setWakeLockStatus('released'); }
  }, []);

  useEffect(() => {
    acquireWakeLock();
    const onVisible = () => { if (document.visibilityState === 'visible') acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); wakeLockRef.current?.release().catch(() => {}); };
  }, [acquireWakeLock]);

  // Network / socket
  useEffect(() => {
    const handleOffline = () => setSocketStatus('disconnected');
    const handleOnline  = () => flush();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => { window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline); };
  }, [flush]);

  useEffect(() => {
    socketService.connect(null, { sessionType: 'MOBILE' }).then(() => setSocketStatus('connected')).catch(() => setSocketStatus('disconnected'));
    const onConnect      = () => { setSocketStatus('connected'); flush(); };
    const onDisconnect   = () => setSocketStatus('disconnected');
    const onReconnecting = () => setSocketStatus('reconnecting');
    const onAuthError    = () => navigate('/login?reason=session-expired');
    const onReconnFailed = () => setSocketStatus('disconnected');
    socketService.on('connect', onConnect); socketService.on('disconnect', onDisconnect);
    socketService.on('reconnecting', onReconnecting); socketService.on('auth_error', onAuthError); socketService.on('reconnect_failed', onReconnFailed);
    return () => {
      socketService.off('connect', onConnect); socketService.off('disconnect', onDisconnect);
      socketService.off('reconnecting', onReconnecting); socketService.off('auth_error', onAuthError); socketService.off('reconnect_failed', onReconnFailed);
    };
  }, [navigate, flush]);

  // GPS watcher
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('unavailable'); return; }
    setGpsStatus('searching');
    const id = navigator.geolocation.watchPosition(
      (pos) => { const c = [pos.coords.longitude, pos.coords.latitude]; setUserCoords(c); setGpsStatus('locked'); try { socketService.updateLocation(c); } catch (_) {} },
      (err) => setGpsStatus(err.code === 1 ? 'unavailable' : 'searching'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const handleBack      = useCallback(() => navigate('/dashboard'), [navigate]);
  const handleShowOnMap = useCallback((coords) => setMapFocusCoords(coords), []);

  return (
    <MobileLayout
      mapSlot={<MobileFieldMap userCoordinates={userCoords} events={events} focusCoords={mapFocusCoords} onFocusConsumed={() => setMapFocusCoords(null)} showZoomControl={window.innerWidth >= 768} gpsStatus={gpsStatus} />}
      user={user} connectionStatus={connectionStatus} gpsStatus={gpsStatus} wakeLockStatus={wakeLockStatus}
      violations={activeViolationCount} userCoordinates={userCoords} onQueueEvent={enqueue} queuedCount={queue.length}
      feedSlot={<MobileEventFeed events={events} loading={eventsLoading} error={eventsError} refetch={refetchEvents} onShowOnMap={handleShowOnMap} onEventUpdate={updateEvent} />}
      notificationSlot={<NotificationPrompt />} onBack={handleBack}
    />
  );
};

export default MobileFieldView;

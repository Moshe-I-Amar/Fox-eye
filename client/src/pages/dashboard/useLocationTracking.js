import { useState, useEffect, useRef } from 'react';
import socketService from '../../services/socketService';
import { userService } from '../../services/usersApi';
import { isValidCoords } from '../../utils/location';

const useLocationTracking = ({ realtimeEnabledRef, socketInitializedRef, onFirstLocation }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const lastLocationSentRef = useRef({ time: 0, coords: null });
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    setLocationLoading(true);
    if (!navigator.geolocation) { setLocationError('Geolocation is not supported by your browser'); setLocationLoading(false); return; }

    const shouldSend = (next) => {
      const last = lastLocationSentRef.current;
      if (!last.coords) return true;
      return Math.abs(last.coords[0] - next[0]) > 0.00005 || Math.abs(last.coords[1] - next[1]) > 0.00005 || Date.now() - last.time > 8000;
    };

    const send = async (lat, lng, heading, speed) => {
      const next = [lat, lng]; if (!shouldSend(next)) return;
      lastLocationSentRef.current = { time: Date.now(), coords: next };
      try {
        if (realtimeEnabledRef.current && socketService.isSocketConnected()) socketService.updateLocation([lng, lat], { heading, speed });
        else if (socketInitializedRef.current) await userService.updateMyLocation([lng, lat]);
      } catch { setLocationError('Failed to update location.'); }
    };

    const watchId = navigator.geolocation.watchPosition(async ({ coords: { latitude, longitude, heading, speed } }) => {
      const loc = [latitude, longitude];
      if (isValidCoords(loc)) {
        setUserLocation(loc);
        if (!hasCenteredRef.current) { onFirstLocation?.(loc); hasCenteredRef.current = true; }
      }
      await send(latitude, longitude, heading, speed); setLocationLoading(false);
    }, () => { setLocationError('Unable to retrieve your location.'); setLocationLoading(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { userLocation, locationLoading, locationError };
};

export default useLocationTracking;

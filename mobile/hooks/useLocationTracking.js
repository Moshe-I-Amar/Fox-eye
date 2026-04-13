import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import socketService from '../services/socketService';

const THROTTLE_DISTANCE = 0.00005; // degrees (~5m)
const THROTTLE_TIME_MS  = 8000;

const useLocationTracking = ({ enabled = true, onFirstLocation } = {}) => {
  const [userLocation,    setUserLocation]    = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError,   setLocationError]   = useState(null);

  const lastCoordsRef    = useRef(null);
  const lastSendTimeRef  = useRef(0);
  const firstFiredRef    = useRef(false);
  const subscriptionRef  = useRef(null);

  const handlePosition = useCallback((pos) => {
    const { latitude, longitude, heading, speed } = pos.coords;
    const coords = [longitude, latitude]; // GeoJSON order for server

    setUserLocation({ lat: latitude, lng: longitude, heading, speed });
    setLocationLoading(false);
    setLocationError(null);

    if (!firstFiredRef.current) {
      firstFiredRef.current = true;
      onFirstLocation?.({ lat: latitude, lng: longitude });
    }

    // Throttle: only send if moved enough OR time elapsed
    const now     = Date.now();
    const last    = lastCoordsRef.current;
    const elapsed = now - lastSendTimeRef.current;
    const moved   = !last ||
      Math.abs(last[0] - coords[0]) > THROTTLE_DISTANCE ||
      Math.abs(last[1] - coords[1]) > THROTTLE_DISTANCE;

    if (moved || elapsed >= THROTTLE_TIME_MS) {
      lastCoordsRef.current   = coords;
      lastSendTimeRef.current = now;
      socketService.updateLocation(coords, {
        heading: heading ?? null,
        speed:   speed   ?? null,
      });
    }
  }, [onFirstLocation]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) {
          setLocationError('Location permission denied');
          setLocationLoading(false);
        }
        return;
      }

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.High,
          timeInterval:     3000,
          distanceInterval: 5, // meters
        },
        (pos) => { if (!cancelled) handlePosition(pos); }
      );
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [enabled, handlePosition]);

  return { userLocation, locationLoading, locationError };
};

export default useLocationTracking;

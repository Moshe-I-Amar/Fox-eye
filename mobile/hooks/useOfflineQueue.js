import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { eventApi } from '../services/eventApi';

const QUEUE_KEY = 'fox-eye-offline-queue';

const loadQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* noop */ }
};

const useOfflineQueue = () => {
  const [queue, setQueue] = useState([]);
  const flushingRef = useRef(false);

  // Load persisted queue on mount
  useEffect(() => {
    loadQueue().then(setQueue);
  }, []);

  const enqueue = useCallback(async (payload) => {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload };
    setQueue((prev) => {
      const next = [...prev, item];
      saveQueue(next);
      return next;
    });
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;

    const current = await loadQueue();
    if (!current.length) { flushingRef.current = false; return; }

    const remaining = [];
    for (const item of current) {
      try {
        await eventApi.createEvent(item.payload);
        // success — don't add to remaining
      } catch (err) {
        const status = err.response?.status;
        // Keep on network error or 5xx; drop on 4xx (invalid payload)
        if (!status || status >= 500) {
          remaining.push(item);
        }
      }
    }

    await saveQueue(remaining);
    setQueue(remaining);
    flushingRef.current = false;
  }, []);

  // Auto-flush when network comes back online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        flush();
      }
    });
    return unsubscribe;
  }, [flush]);

  return { queue, enqueue, flush };
};

export default useOfflineQueue;

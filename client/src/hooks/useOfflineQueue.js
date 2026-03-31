import { useState, useCallback } from 'react';
import { eventApi } from '../services/eventApi';

const STORAGE_KEY = 'fox-eye-offline-queue';

const loadQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveQueue = (queue) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (_) {}
};

/**
 * useOfflineQueue — persist and flush field events queued while offline.
 *
 * Returns { queue, enqueue, flush }
 *   queue    — current pending items array
 *   enqueue  — save a failed event payload for later retry
 *   flush    — attempt to send all queued items; drops 4xx, retains network errors
 */
const useOfflineQueue = () => {
  const [queue, setQueue] = useState(loadQueue);

  const enqueue = useCallback((payload) => {
    const item = { ...payload, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setQueue((prev) => {
      const next = [...prev, item];
      saveQueue(next);
      return next;
    });
  }, []);

  const flush = useCallback(async () => {
    const current = loadQueue();
    if (current.length === 0) return;

    const failed = [];
    for (const item of current) {
      try {
        const { id, ...payload } = item;
        await eventApi.createEvent(payload);
      } catch (err) {
        // Retain on network errors or 5xx; drop on 4xx (anti-spam, invalid)
        if (!err.status || err.status >= 500) {
          failed.push(item);
        }
      }
    }
    saveQueue(failed);
    setQueue(failed);
  }, []);

  return { queue, enqueue, flush };
};

export default useOfflineQueue;

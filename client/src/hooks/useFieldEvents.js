import { useState, useCallback, useEffect } from 'react';
import { eventApi } from '../services/eventApi';
import socketService from '../services/socketService';

/**
 * useFieldEvents — fetch field events and subscribe to live updates.
 *
 * @param {number} [limit=20]  — max records per fetch
 *
 * Returns { events, loading, error, refetch, updateEvent }
 * updateEvent(id, patch) — optimistic local update before socket arrives
 */
const useFieldEvents = (limit = 20) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await eventApi.getEvents({ limit });
      setEvents(data.events || []);
    } catch {
      setError('Failed to load field events.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const onNew = ({ event }) =>
      setEvents((prev) => [event, ...prev].slice(0, limit));

    // Merge onto existing entry to preserve populated fields (e.g. senderId.name)
    // that aren't re-populated in the ACK/RESOLVE broadcast.
    const onAck = ({ event }) =>
      setEvents((prev) => prev.map((e) =>
        e._id === event._id ? { ...event, senderId: e.senderId ?? event.senderId } : e
      ));

    const onResolved = ({ event }) =>
      setEvents((prev) => prev.map((e) =>
        e._id === event._id ? { ...event, senderId: e.senderId ?? event.senderId } : e
      ));

    socketService.on('field:event:new',          onNew);
    socketService.on('field:event:acknowledged', onAck);
    socketService.on('field:event:resolved',     onResolved);

    return () => {
      socketService.off('field:event:new',          onNew);
      socketService.off('field:event:acknowledged', onAck);
      socketService.off('field:event:resolved',     onResolved);
    };
  }, [limit]);

  const updateEvent = useCallback((id, patch) => {
    setEvents((prev) => prev.map((e) => e._id === id ? { ...e, ...patch } : e));
  }, []);

  return { events, loading, error, refetch, updateEvent };
};

export default useFieldEvents;

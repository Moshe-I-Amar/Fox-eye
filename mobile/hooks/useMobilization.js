import { useState, useEffect, useCallback } from 'react';
import { mobilizationApi } from '../services/mobilizationApi';
import socketService from '../services/socketService';

const useMobilization = ({ realtimeEnabled } = {}) => {
  const [activeMobilization, setActiveMobilization] = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [sending,            setSending]            = useState(false);
  const [error,              setError]              = useState(null);

  useEffect(() => {
    let active = true;
    mobilizationApi.getActive()
      .then(({ mobilizations }) => {
        if (!active) return;
        setActiveMobilization(mobilizations?.[0] || null);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!realtimeEnabled) return;
    const patch = ({ mobilization }) => setActiveMobilization(mobilization);
    socketService.on('mobilization:activated',      patch);
    socketService.on('mobilization:status_changed', patch);
    socketService.on('mobilization:stood_down',     patch);
    return () => {
      socketService.off('mobilization:activated',      patch);
      socketService.off('mobilization:status_changed', patch);
      socketService.off('mobilization:stood_down',     patch);
    };
  }, [realtimeEnabled]);

  const trigger = useCallback(async (payload) => {
    setSending(true);
    setError(null);
    try {
      const { mobilization } = await mobilizationApi.trigger(payload);
      setActiveMobilization(mobilization);
      return mobilization;
    } catch (err) {
      setError(err.message || 'Failed to trigger mobilization');
      throw err;
    } finally {
      setSending(false);
    }
  }, []);

  const advanceStatus = useCallback(async (id, status) => {
    setSending(true);
    setError(null);
    try {
      const { mobilization } = await mobilizationApi.advanceStatus(id, status);
      setActiveMobilization(mobilization);
    } catch (err) {
      setError(err.message || 'Failed to advance phase');
    } finally {
      setSending(false);
    }
  }, []);

  const standDown = useCallback(async (id) => {
    setSending(true);
    setError(null);
    try {
      const { mobilization } = await mobilizationApi.standDown(id);
      setActiveMobilization(mobilization);
    } catch (err) {
      setError(err.message || 'Failed to stand down');
    } finally {
      setSending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { activeMobilization, loading, sending, error, trigger, advanceStatus, standDown, clearError };
};

export default useMobilization;

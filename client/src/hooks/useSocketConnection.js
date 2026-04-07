import { useEffect, useState } from 'react';
import socketService from '../services/socketService';
import { authService } from '../services/authApi';

/**
 * Manages the socket.io connection lifecycle.
 * Shared between Dashboard and Admin pages.
 *
 * @param {object} options
 * @param {function} options.navigate  — react-router navigate for auth-error redirect
 * @param {function} [options.onConnect] — called when socket connects/reconnects
 * @returns {{ realtimeEnabled, realtimeStatus, realtimeNotice, realtimeNoticeTone, clearRealtimeNotice }}
 */
const useSocketConnection = ({ navigate, onConnect } = {}) => {
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('offline');
  const [realtimeNotice, setRealtimeNotice] = useState('');
  const [realtimeNoticeTone, setRealtimeNoticeTone] = useState('warning');

  useEffect(() => {
    const handleConnect = () => {
      setRealtimeEnabled(true);
      setRealtimeStatus('connected');
      setRealtimeNotice('');
      onConnect?.();
    };

    const handleDisconnect = (payload = {}) => {
      const reason = payload?.reason;
      if (reason === 'io client disconnect' || reason === 'auth_error') {
        setRealtimeStatus('offline');
        return;
      }
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates disconnected. Attempting to reconnect...');
    };

    const handleReconnect = () => {
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Reconnecting to live updates...');
    };

    const handleConnectError = () => {
      setRealtimeStatus('reconnecting');
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates disconnected. Attempting to reconnect...');
    };

    const handleReconnectFailed = () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('warning');
      setRealtimeNotice('Live updates are unavailable. Using HTTP fallback.');
    };

    const handleAuthError = async () => {
      setRealtimeStatus('offline');
      setRealtimeEnabled(false);
      setRealtimeNoticeTone('error');
      setRealtimeNotice('Session expired. Redirecting to login...');
      await authService.logout();
      navigate?.('/login', { replace: true, state: { reason: 'session-expired', message: 'Your session expired. Please sign in again.' } });
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('reconnecting', handleReconnect);
    socketService.on('connect_error', handleConnectError);
    socketService.on('reconnect_failed', handleReconnectFailed);
    socketService.on('auth_error', handleAuthError);

    (async () => {
      try {
        await socketService.connect(null);
        setRealtimeEnabled(true);
        setRealtimeStatus('connected');
        onConnect?.();
      } catch (error) {
        const msg = `${error?.message || ''}`.toLowerCase();
        if (msg.includes('authentication error') || msg.includes('token expired') || msg.includes('invalid token')) return;
        setRealtimeEnabled(false);
        setRealtimeStatus('offline');
      }
    })();

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('reconnecting', handleReconnect);
      socketService.off('connect_error', handleConnectError);
      socketService.off('reconnect_failed', handleReconnectFailed);
      socketService.off('auth_error', handleAuthError);
      socketService.disconnect();
    };
  }, [navigate, onConnect]);

  return { realtimeEnabled, realtimeStatus, realtimeNotice, realtimeNoticeTone,
    clearRealtimeNotice: () => setRealtimeNotice('') };
};

export default useSocketConnection;

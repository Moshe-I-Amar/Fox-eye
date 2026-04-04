import { useState, useEffect, useCallback } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  getSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '../services/pushService';

const isSupported = () =>
  'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

const useNotifications = () => {
  const [supported,   setSupported]   = useState(false);
  const [permission,  setPermission]  = useState('default');
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    if (!isSupported()) return;
    setSupported(true);
    setPermission(getNotificationPermission());
    getSubscription().then((sub) => setSubscribed(!!sub)).catch(() => {});
  }, []);

  const enable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      if (perm === 'granted') {
        await subscribeToPush();
        setSubscribed(true);
      }
    } catch (err) {
      setError(err?.message || 'Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } catch (err) {
      setError(err?.message || 'Failed to disable notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, permission, subscribed, loading, error, enable, disable };
};

export default useNotifications;

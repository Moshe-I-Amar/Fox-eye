import api from './api';

const isSupported = () =>
  'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const getNotificationPermission = () => {
  if (!isSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async () => {
  if (!isSupported()) return 'unsupported';
  return Notification.requestPermission();
};

export const getSubscription = async () => {
  if (!isSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
};

export const subscribeToPush = async () => {
  const res = await api.get('/api/push/vapid-public-key');
  const vapidPublicKey = res.data.data.vapidPublicKey;

  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await api.post('/api/push/subscribe', { subscription: subscription.toJSON() });
  return subscription;
};

export const unsubscribeFromPush = async () => {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;
  await api.delete('/api/push/subscribe', { data: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
};

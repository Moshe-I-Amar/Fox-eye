import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const EXPO_TOKEN_KEY = 'fox_eye_expo_push_token';

// Show notifications while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

/**
 * Registers the device with the Expo push service and sends the token to the
 * Fox-Eye backend on first login (or when the stored token changes).
 *
 * Must be called inside an authenticated session.
 */
const usePushNotifications = () => {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    (async () => {
      try {
        // 1. Request permission
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // 2. Get Expo push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });

        // 3. Check if already registered with this token
        const stored = await AsyncStorage.getItem(EXPO_TOKEN_KEY);
        if (stored === expoToken) return; // no change

        // 4. Register with backend
        await api.post('/api/push/subscribe/mobile', { expoToken });
        await AsyncStorage.setItem(EXPO_TOKEN_KEY, expoToken);
      } catch (err) {
        // Non-fatal — push is best-effort
        console.warn('[usePushNotifications]', err.message);
      }
    })();
  }, []);
};

export default usePushNotifications;

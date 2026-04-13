import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as Location from 'expo-location';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';

function RootGuard() {
  const { user, authReady } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!authReady) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, authReady, segments]);

  // Request location permission once — must happen before any panic press
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().catch(() => {});
  }, []);

  if (!authReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGuard />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: Colors.jet,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

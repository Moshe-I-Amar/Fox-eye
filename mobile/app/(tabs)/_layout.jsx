import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, TAB_BAR_HEIGHT } from '../../constants/theme';
import PanicFAB from '../../components/PanicFAB';
import { useAuth } from '../../context/AuthContext';
import { getToken } from '../../services/api';
import socketService from '../../services/socketService';
import usePushNotifications from '../../hooks/usePushNotifications';

// Simple icon labels — replace with expo/vector-icons if desired
const TAB_ICONS = {
  index:    { icon: '⊕', label: 'MAP' },
  events:   { icon: '⚠', label: 'EVENTS' },
  mobilize: { icon: '📡', label: 'MOBILIZE' },
};

function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused   = state.index === index;
        const config      = TAB_ICONS[route.name] || { icon: '•', label: route.name.toUpperCase() };

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <Text style={[styles.icon, isFocused && styles.iconActive]}>{config.icon}</Text>
            <Text style={[styles.label, isFocused && styles.labelActive]}>{config.label}</Text>
            {isFocused && <View style={styles.underline} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();

  // Connect socket with Bearer token when tabs mount (user is authenticated)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!cancelled && token) {
        socketService.connect(token);
      }
    })();
    return () => {
      cancelled = true;
      socketService.disconnect();
    };
  }, [user?._id]);

  // Register device for Expo push notifications
  usePushNotifications();

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index"    options={{ title: 'Map' }} />
        <Tabs.Screen name="events"   options={{ title: 'Events' }} />
        <Tabs.Screen name="mobilize" options={{ title: 'Mobilize' }} />
      </Tabs>

      {/* PanicFAB floats above the tab bar on every screen */}
      <PanicFAB />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.jet,
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    backgroundColor: Colors.charcoal,
    borderTopWidth: 1,
    borderTopColor: `${Colors.gold}33`,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 18,
    color: Colors.gray400,
    marginBottom: 2,
  },
  iconActive: {
    color: Colors.gold,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.gray400,
    fontWeight: '600',
  },
  labelActive: {
    color: Colors.gold,
  },
  underline: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: Colors.gold,
    borderRadius: 1,
  },
});

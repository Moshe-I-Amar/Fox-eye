import { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getToken } from '../../services/api';
import socketService from '../../services/socketService';
import useLocationTracking from '../../hooks/useLocationTracking';

const CLIENT_URL = process.env.EXPO_PUBLIC_CLIENT_URL || '';
const MAP_URL    = CLIENT_URL ? `${CLIENT_URL}/mobile-map.html` : null;

export default function MapTab() {
  const { user }      = useAuth();
  const webViewRef    = useRef(null);

  const sendToMap = useCallback((type, payload) => {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(${JSON.stringify({ type, payload })}) })); true;`
    );
  }, []);

  // Forward live location updates from socket to the map WebView
  useEffect(() => {
    const handler = (data) => sendToMap('LOCATION_UPDATE', data);
    socketService.on('location:update', handler);
    return () => socketService.off('location:update', handler);
  }, [sendToMap]);

  // Forward field events
  useEffect(() => {
    const handler = (data) => sendToMap('EVENT_UPDATE', data);
    socketService.on('field:event:new', handler);
    return () => socketService.off('field:event:new', handler);
  }, [sendToMap]);

  const handleWebViewMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      // Handle map → RN messages (e.g. marker click) here
      console.log('[MapTab] WebView message:', msg);
    } catch { /* noop */ }
  }, []);

  if (!MAP_URL) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Map unavailable.{'\n'}Set EXPO_PUBLIC_CLIENT_URL in your .env file.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        source={{ uri: MAP_URL }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Loading map…</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.jet,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.jet,
  },
  fallback: {
    flex: 1,
    backgroundColor: Colors.jet,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  fallbackText: {
    color: Colors.gray400,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
  },
  loading: {
    position: 'absolute',
    inset: 0,
    flex: 1,
    backgroundColor: Colors.jet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.gray400,
    fontSize: 13,
  },
});

import { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/theme';

const TONES = {
  error:   { bg: '#7f1d1d', border: Colors.red400,   text: Colors.red400 },
  warning: { bg: '#78350f', border: Colors.amber400,  text: Colors.amber400 },
  success: { bg: '#14532d', border: Colors.green400,  text: Colors.green400 },
  info:    { bg: '#1e3a5f', border: '#60a5fa',        text: '#93c5fd' },
};

export default function AlertBanner({ message, tone = 'error', onDismiss, autoDismissMs }) {
  const t        = TONES[tone] || TONES.error;
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }).start();

    if (autoDismissMs) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: t.bg, borderColor: t.border },
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={[styles.text, { color: t.text }]} numberOfLines={3}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.close}>
          <Text style={[styles.closeText, { color: t.text }]}>✕</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  close: {
    marginLeft: 10,
    padding: 4,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

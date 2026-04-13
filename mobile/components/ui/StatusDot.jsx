import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

const STATE_COLORS = {
  connected:    Colors.green400,
  reconnecting: Colors.amber400,
  disconnected: Colors.red400,
};

export default function StatusDot({ state = 'disconnected', size = 10 }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const color     = STATE_COLORS[state] || Colors.red400;
  const shouldPulse = state === 'connected' || state === 'reconnecting';

  useEffect(() => {
    if (!shouldPulse) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        { opacity: pulseAnim },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});

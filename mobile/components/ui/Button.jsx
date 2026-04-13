import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Shadows } from '../../constants/theme';

const VARIANTS = {
  primary: {
    container: { backgroundColor: Colors.gold, ...Shadows.goldGlow },
    text:      { color: Colors.jet },
  },
  secondary: {
    container: { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: `${Colors.gold}40` },
    text:      { color: Colors.gold },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text:      { color: Colors.gray400 },
  },
  danger: {
    container: { backgroundColor: Colors.red400 },
    text:      { color: Colors.white },
  },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <TouchableOpacity
      style={[styles.base, v.container, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={[styles.text, v.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  disabled: {
    opacity: 0.5,
  },
});

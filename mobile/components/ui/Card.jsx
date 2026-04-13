import { View, StyleSheet } from 'react-native';
import { Colors, Shadows } from '../../constants/theme';

export default function Card({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.charcoal,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.gold}33`,
    padding: 14,
    ...Shadows.goldGlow,
  },
});

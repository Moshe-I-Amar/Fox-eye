export const Colors = {
  jet:       '#0a0a0a',
  charcoal:  '#1a1a1a',
  slateDark: '#2d2d2d',
  gold:      '#C7A76C',
  goldLight: '#D4B97A',
  white:     '#FFFFFF',
  gray400:   '#9ca3af',
  gray600:   '#4b5563',
  red400:    '#f87171',
  amber400:  '#fbbf24',
  green400:  '#4ade80',
};

export const Shadows = {
  goldGlow: {
    shadowColor: '#C7A76C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
};

export const Typography = {
  heading: { fontWeight: '700', color: Colors.white },
  label:   { fontWeight: '600', color: Colors.gold },
  body:    { fontWeight: '400', color: Colors.gray400 },
  small:   { fontSize: 12,     color: Colors.gray400 },
};

export const TAB_BAR_HEIGHT = 64;

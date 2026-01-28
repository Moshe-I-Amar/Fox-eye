/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'jet': '#0a0a0a',
        'charcoal': '#1a1a1a',
        'slate-dark': '#2d2d2d',
        'slate-medium': '#404040',
        'gold': '#C7A76C',
        'gold-light': '#D4B57E',
        'gold-dark': '#A68B5B'
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #C7A76C, #D4B57E)',
        'gradient-dark': 'linear-gradient(180deg, #0a0a0a, #1a1a1a)'
      },
      boxShadow: {
        'gold-glow': '0 0 20px rgba(199, 167, 108, 0.3)',
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
      },
      backdropBlur: {
        'glass': '12px'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}
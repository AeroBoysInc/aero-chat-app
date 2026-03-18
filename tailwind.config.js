/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aero: {
          cyan:  '#00d4ff',
          sky:   '#4fc3f7',
          blue:  '#1a6fd4',
          deep:  '#0a3d8f',
          teal:  '#00b4a6',
          green: '#4fc97a',
          red:   '#ff5c5c',
        },
      },
      boxShadow: {
        glass: '0 4px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
        gloss: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
      },
      borderRadius: {
        aero: '12px',
        'aero-lg': '20px',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

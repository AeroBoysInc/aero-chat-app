/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aero: {
          cyan:   '#00d4ff',
          sky:    '#4fc3f7',
          blue:   '#1a6fd4',
          deep:   '#0a3d8f',
          teal:   '#00b4a6',
          green:  '#4fc97a',
          red:    '#ff5c5c',
          orange: '#e07800',
        },
        navy: {
          DEFAULT: '#1a3553',
          mid:     '#3a6585',
          soft:    '#6a96b5',
        },
        bubble: {
          sent:     '#52c852',
          'sent-2': '#38b038',
          recv:     '#e4f3fc',
          'recv-2': '#cce7f8',
        },
      },
      boxShadow: {
        glass:     '0 4px 24px rgba(0,80,160,0.15), inset 0 1px 0 rgba(255,255,255,0.80)',
        'glass-lg':'0 8px 40px rgba(0,80,160,0.22), inset 0 1px 0 rgba(255,255,255,0.90)',
        gloss:     '0 2px 8px rgba(0,80,160,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
        glow:      '0 0 24px rgba(0,180,255,0.40)',
        'glow-sm': '0 0 10px rgba(0,180,255,0.30)',
        'glow-green': '0 0 10px rgba(60,200,60,0.45)',
        orange:    '0 2px 12px rgba(200,100,0,0.35)',
      },
      borderRadius: {
        aero:    '12px',
        'aero-lg': '20px',
        'aero-xl': '28px',
      },
      keyframes: {
        'fade-in':  { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%':      { transform: 'translateY(-12px) scale(1.03)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5' },
          '50%':      { opacity: '0.9' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.18s ease-out',
        'slide-up':   'slide-up 0.22s ease-out',
        'float':      'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

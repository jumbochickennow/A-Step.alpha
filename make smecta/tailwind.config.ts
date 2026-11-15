import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '390px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { 1: 'var(--surface-1)', 2: 'var(--surface-2)' },
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        ink: { DEFAULT: 'var(--text)', muted: 'var(--text-muted)', subtle: 'var(--text-subtle)', 'muted-light': 'var(--text-muted-light)' },
        brand: { blue: 'var(--blue)', 'blue-text': 'var(--blue-text)', 'blue-text-light': 'var(--blue-text-light)', coral: 'var(--coral)', 'coral-btn': 'var(--coral-btn)', 'coral-text': 'var(--coral-text)' },
        footer: { DEFAULT: 'var(--footer-bg)', card: 'var(--footer-card)', 'card-blue': 'var(--footer-card-on-blue)' },
        primary: { DEFAULT: '#ff5e59', hover: '#cc3a35', light: '#4da3f5', dark: '#cc3a35' },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
        modal: 'var(--shadow-modal)',
      },
      fontSize: {
        micro: ['var(--text-micro)', { lineHeight: '1rem' }],
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },
      fontFamily: {
        sans: ['var(--font-brand)'],
      },
      keyframes: {
        'fade-rise': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise var(--motion-slow) var(--ease-out-expo) both',
      },
    },
  },
  plugins: [],
} satisfies Config;

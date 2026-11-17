/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0f172a', soft: '#334155', muted: '#64748b', faint: '#94a3b8' },
        line: '#e2e8f0',
        surface: '#f1f5f9',
        paper: '#f8fafc',
        navy: { 800: '#111a2e', 900: '#0b1220', 950: '#070c17' },
        brand: { DEFAULT: '#059669', light: '#ecfdf5', dark: '#047857' },
        signal: { 50: '#ecfdf5', 100: '#d1fae5', 300: '#6ee7b7', 500: '#10b981', 600: '#059669', 700: '#047857' },
        easy: { DEFAULT: '#047857', light: '#ecfdf5' },
        medium: { DEFAULT: '#b45309', light: '#fffbeb' },
        hard: { DEFAULT: '#b91c1c', light: '#fef2f2' },
        java: { DEFAULT: '#b45309', light: '#fff4e5', 100: '#fef0d9', 500: '#ea8a1f', 700: '#9a5410' },
        python: { DEFAULT: '#1d4ed8', light: '#eaf1ff', 100: '#e0ebff', 500: '#3b82f6', 700: '#1e40af' }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 4px 16px -8px rgba(15,23,42,.10)',
        lift: '0 2px 4px rgba(15,23,42,.05), 0 18px 36px -16px rgba(15,23,42,.22)',
        glow: '0 8px 24px -8px rgba(5,150,105,.55)'
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } }
      },
      animation: { 'fade-up': 'fadeUp .45s ease-out both', float: 'float 6s ease-in-out infinite' }
    }
  },
  plugins: []
};

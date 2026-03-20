/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Kinetic Terminal Theme - Matrix Green & Cyan on Pure Black
        // Foundation - Pure black backgrounds
        'void': '#000000',
        'void-80': 'rgba(0, 0, 0, 0.8)',
        'void-60': 'rgba(0, 0, 0, 0.6)',
        'void-40': 'rgba(0, 0, 0, 0.4)',
        
        // Surface containers (dark gray elevation scale)
        'surface-container-lowest': '#0e0e0e',
        'surface-container-low': '#1b1b1b',
        'surface-container': '#1f1f1f',
        'surface-container-high': '#2a2a2a',
        'surface-container-highest': '#353535',
        'surface-variant': '#353535',
        'surface-bright': '#393939',
        
        // Primary - Matrix Green
        'matrix-green': '#00FF41',
        'matrix-green-dim': '#00e639',
        'matrix-green-fixed': '#72ff70',
        'matrix-green-fixed-dim': '#00e639',
        
        // Secondary - Cyan
        'cyan-accent': '#00FFFF',
        'cyan-fixed': '#00fbfb',
        'cyan-fixed-dim': '#00dddd',
        
        // Error - Neon Red
        'neon-red': '#FF003C',
        'error-container': '#93000a',
        'error': '#ffb4ab',
        
        // Outline & borders
        'outline': '#84967e',
        'outline-variant': '#3b4b37',
        
        // Text colors
        'on-surface': '#e2e2e2',
        'on-surface-variant': '#b9ccb2',
        'inverse-surface': '#e2e2e2',
        'inverse-on-surface': '#303030',
        'on-background': '#e2e2e2',
        
        // Semantic color mappings (for backward compatibility)
        'primary-container': '#00FF41',
        'secondary-container': '#00fbfb',
        'on-primary': '#003907',
        'on-secondary': '#003737',
        'on-secondary-container': '#007070',
        'on-secondary-fixed': '#002020',
        'on-secondary-fixed-variant': '#004f4f',
        'on-primary-fixed': '#002203',
        'on-primary-fixed-variant': '#00530e',
        'on-primary-container': '#007117',
        'on-error': '#690005',
        'on-error-container': '#ffdad6',
        
        // Tertiary
        'tertiary': '#fff7f7',
        'tertiary-container': '#ffd2d0',
        'tertiary-fixed': '#ffdad8',
        'tertiary-fixed-dim': '#ffb3b2',
        'on-tertiary': '#680012',
        'on-tertiary-container': '#c3002c',
        'on-tertiary-fixed': '#410008',
        'on-tertiary-fixed-variant': '#92001e',
        
        // Legacy mappings
        'surface-tint': '#00e639',
        'inverse-primary': '#006e16',
        'surface-dim': '#131313',
        'surface': '#131313',
        'background': '#000000',
        'primary': '#ebffe2',
        'secondary': '#ffffff',
        
        // Semantic aliases
        'accent': 'var(--color-matrix-green)',
        'accent-light': 'var(--color-cyan-accent)',
        'accent-soft': 'rgba(0, 255, 65, 0.1)',
        'success': '#10b981',
        'success-soft': 'rgba(16, 185, 129, 0.12)',
        'warning': '#f59e0b',
        'warning-soft': 'rgba(245, 158, 11, 0.12)',
        'danger': '#FF003C',
        'danger-soft': 'rgba(255, 0, 60, 0.12)',
        'info': '#06b6d4',
        
        // UI colors from CSS
        'fg': '#e2e2e2',
        'fg-strong': '#ffffff',
        'muted': 'rgba(255, 255, 255, 0.5)',
        'muted-light': 'rgba(255, 255, 255, 0.7)',
        'border': 'rgba(255, 255, 255, 0.06)',
        'border-strong': 'rgba(255, 255, 255, 0.10)',
        'bg': '#000000',
        'bg-elevated': '#0e0e0e',
        'surface-elevated': '#1f1f1f',
      },
      fontFamily: {
        'headline': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'body': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'label': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'mono': ['Fira Code', 'SF Mono', 'monospace'],
        'sans': ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'none': '0px',
        'DEFAULT': '0px',
        'lg': '0px',
        'xl': '0px',
        'full': '9999px',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      boxShadow: {
        'glow-primary': '0 0 10px rgba(0, 255, 65, 0.4)',
        'glow-primary-strong': '0 0 20px rgba(0, 255, 65, 0.6)',
        'glow-danger': '0 0 15px rgba(255, 0, 60, 0.8)',
        'glow-cyan': '0 0 15px rgba(0, 255, 255, 0.3)',
        'terminal-glow': '0 0 10px rgba(0, 255, 65, 0.2)',
      },
      animation: {
        'pulse-live': 'pulse-live 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-danger': 'pulse-danger 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
        'pulse-danger': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 0, 60, 0.6)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 0, 60, 1)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 255, 65, 0.4)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(0, 255, 65, 0.4)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

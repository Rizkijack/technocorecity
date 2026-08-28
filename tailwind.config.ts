import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
    './src/stores/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep': 'var(--bg-deep)',
        'bg-mid': 'var(--bg-mid)',
        'bg-elev': 'var(--bg-elev)',
        'bg-light': 'var(--bg-light)',
        'accent-cyan': 'var(--accent-cyan)',
        'accent-magenta': 'var(--accent-magenta)',
        'accent-amber': 'var(--accent-amber)',
        'accent-green': 'var(--accent-green)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-disabled': 'var(--text-disabled)',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'panel-elev': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'panel-glow': '0 0 24px rgba(0, 212, 255, 0.15)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config

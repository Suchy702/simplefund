import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        input: 'var(--border-strong)',
        ring: 'var(--brand)',
        background: 'var(--bg)',
        foreground: 'var(--ink)',
        primary: {
          DEFAULT: 'var(--brand)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--bg-subtle)',
          foreground: 'var(--ink)',
        },
        muted: {
          DEFAULT: 'var(--bg-subtle)',
          foreground: 'var(--ink-3)',
        },
        accent: {
          DEFAULT: 'var(--bg-hover)',
          foreground: 'var(--ink)',
        },
        destructive: {
          DEFAULT: 'var(--neg)',
          foreground: 'var(--bg-elevated)',
        },
        card: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--ink)',
        },
        popover: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--ink)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
        surface: {
          DEFAULT: 'var(--bg)',
          elevated: 'var(--bg-elevated)',
          subtle: 'var(--bg-subtle)',
          hover: 'var(--bg-hover)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          ink: 'var(--brand-ink)',
          soft: 'var(--brand-soft)',
        },
        pos: {
          DEFAULT: 'var(--pos)',
          soft: 'var(--pos-soft)',
        },
        neg: {
          DEFAULT: 'var(--neg)',
          soft: 'var(--neg-soft)',
        },
        cat: {
          1: 'var(--cat-1)',
          2: 'var(--cat-2)',
          3: 'var(--cat-3)',
          4: 'var(--cat-4)',
        },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
      },
      spacing: {
        '4.5': '18px',
        '5.5': '22px',
        '6.5': '26px',
        '7.5': '30px',
      },
      fontSize: {
        tiny: ['11px', { lineHeight: '1.2' }],
        '13': ['13px', { lineHeight: '1.4' }],
        '26': ['26px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        '28': ['28px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        '42': ['42px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },
      letterSpacing: {
        tightest: '-0.03em',
        tighter2: '-0.02em',
        wider2: '0.06em',
        widest2: '0.1em',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;

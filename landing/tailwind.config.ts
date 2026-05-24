import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05060A',
          900: '#0A0B12',
          800: '#0F1018',
          700: '#171823',
          600: '#1F2030',
          500: '#2A2C40',
          400: '#3A3D55',
          300: '#5C6080',
          200: '#9CA0BC',
          100: '#D4D6E5',
        },
        brand: {
          50: '#EEF1FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        violet: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        cyan: {
          400: '#22D3EE',
          500: '#06B6D4',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Inter', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'grid-fade':
          'linear-gradient(to bottom, transparent 0%, #05060A 80%), radial-gradient(circle at center, #0A0B12 0%, #05060A 70%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(99,102,241,0.15), 0 16px 60px -16px rgba(99,102,241,0.45)',
        glowLg: '0 0 0 1px rgba(139,92,246,0.18), 0 30px 100px -20px rgba(139,92,246,0.55)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(0,0,0,0.5)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.85)' },
        },
        scan: {
          '0%': { transform: 'translateY(-110%)' },
          '100%': { transform: 'translateY(110%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        pulseDot: 'pulseDot 2s ease-in-out infinite',
        scan: 'scan 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

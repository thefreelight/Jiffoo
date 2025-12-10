/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Jiffoo Blue - Primary Brand Color
        jf: {
          primary: '#3B82F6',
          'primary-hover': '#2563EB',
          'primary-light': '#EFF6FF',
          'bg-main': '#F8FAFC',
          'bg-card': '#FFFFFF',
          'text-main': '#0F172A',
          'text-muted': '#64748B',
          border: '#E2E8F0',
        },
        // Admin Blue Minimal Design Tokens
        admin: {
          // Background
          'bg-body': '#F1F5F9',
          'bg-card': '#FFFFFF',
          'bg-sidebar': '#FFFFFF',
          // Primary
          primary: '#3B82F6',
          'primary-light': '#EFF6FF',
          'primary-hover': '#2563EB',
          // Text
          'text-main': '#0F172A',
          'text-muted': '#64748B',
          // Border
          border: '#E2E8F0',
          // Status
          'success-bg': '#DCFCE7',
          'success-text': '#166534',
          'warning-bg': '#FEF9C3',
          'warning-text': '#854D0E',
          'error-bg': '#FEE2E2',
          'error-text': '#991B1B',
        },
        // Brand Colors - Blue primary
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB', // Main brand color
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        // Neutral Colors - Slate
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        // Semantic Colors
        success: {
          50: '#DCFCE7',
          100: '#BBF7D0',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          50: '#FEF3C7',
          100: '#FDE68A',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          50: '#FEE2E2',
          100: '#FECACA',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#DBEAFE',
          100: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        // Jiffoo Blue font
        outfit: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      spacing: {
        '0': '0px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
        '24': '96px',
        // Admin layout dimensions
        'sidebar': '260px',
        'header': '70px',
      },
      // Admin layout specific
      width: {
        sidebar: '260px',
      },
      height: {
        header: '70px',
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '32px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        // Brand shadows with blue tint
        'brand-sm': '0 4px 14px -3px rgba(37, 99, 235, 0.15)',
        'brand-md': '0 10px 30px -10px rgba(37, 99, 235, 0.3)',
        'brand-lg': '0 20px 40px -10px rgba(37, 99, 235, 0.4)',
        // Jiffoo Blue shadows
        'jf-button': '0 4px 14px -4px rgba(59, 130, 246, 0.5)',
        'jf-button-hover': '0 6px 20px -4px rgba(59, 130, 246, 0.6)',
        'jf-card': '0 25px 50px -12px rgba(59, 130, 246, 0.15)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'fade-in-up': 'fadeInUp 300ms ease-out',
        'scale-in': 'scaleIn 150ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
};


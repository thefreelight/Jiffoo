/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'], mono: ['JetBrains Mono', 'Menlo', 'monospace'], outfit: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'] },
      spacing: { '0': '0px', '1': '4px', '2': '8px', '3': '12px', '4': '16px', '6': '24px', '8': '32px', '12': '48px', '16': '64px', '24': '96px', sidebar: '260px', header: '70px' },
      width: { sidebar: '260px' },
      height: { header: '70px' },
      borderRadius: { none: '0', sm: 'var(--admin-radius-sm)', DEFAULT: '6px', md: 'var(--admin-radius-md)', lg: 'var(--admin-radius-lg)', xl: '16px', '2xl': '24px', '3xl': '32px', full: '9999px' },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(from var(--admin-overlay-ink) r g b / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(from var(--admin-overlay-ink) r g b / 0.1), 0 1px 2px -1px rgb(from var(--admin-overlay-ink) r g b / 0.1)',
        md: '0 4px 6px -1px rgb(from var(--admin-overlay-ink) r g b / 0.1), 0 2px 4px -2px rgb(from var(--admin-overlay-ink) r g b / 0.1)',
        lg: '0 10px 15px -3px rgb(from var(--admin-overlay-ink) r g b / 0.1), 0 4px 6px -4px rgb(from var(--admin-overlay-ink) r g b / 0.1)',
        xl: '0 20px 25px -5px rgb(from var(--admin-overlay-ink) r g b / 0.1), 0 8px 10px -6px rgb(from var(--admin-overlay-ink) r g b / 0.1)',
        '2xl': '0 25px 50px -12px rgb(from var(--admin-overlay-ink) r g b / 0.25)',
        'brand-sm': '0 4px 14px -3px rgb(from var(--admin-info) r g b / 0.15)',
        'brand-md': '0 10px 30px -10px rgb(from var(--admin-info) r g b / 0.3)',
        'brand-lg': '0 20px 40px -10px rgb(from var(--admin-info) r g b / 0.4)',
        'jf-button': '0 4px 14px -4px rgb(from var(--admin-primary) r g b / 0.5)',
        'jf-button-hover': '0 6px 20px -4px rgb(from var(--admin-primary) r g b / 0.6)',
        'jf-card': '0 25px 50px -12px rgb(from var(--admin-primary) r g b / 0.15)',
      },
      transitionDuration: { fast: '150ms', normal: '300ms', slow: '500ms' },
      animation: { 'fade-in': 'fadeIn 300ms ease-out', 'fade-in-up': 'fadeInUp 300ms ease-out', 'scale-in': 'scaleIn 150ms ease-out' },
      keyframes: { fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } }, fadeInUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }, scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } } },
    },
  },
};

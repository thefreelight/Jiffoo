/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--shop-canvas)',
        surface: 'var(--shop-surface)',
        ink: 'var(--shop-ink)',
        subtle: 'var(--shop-subtle)',
        line: 'var(--shop-line)',
        action: 'var(--shop-action)',
        'action-ink': 'var(--shop-action-ink)',
        highlight: 'var(--shop-highlight)',
      },
      fontFamily: { sans: 'var(--shop-font)' },
      borderRadius: { shop: 'var(--shop-radius)' },
    },
  },
  plugins: [],
};

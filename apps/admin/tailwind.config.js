/** @type {import('tailwindcss').Config} */
const tokens = require('../api/builtin-themes/default-admin/theme.json').tokens;
const tokenColor = (role) => `rgb(var(--admin-${role}-rgb) / <alpha-value>)`;
const semanticColor = (role) => ({ opacityValue }) => opacityValue === undefined
  ? `var(--admin-${role === 'surface' ? 'surface-gradient' : role})`
  : `rgb(var(--admin-${role}-rgb) / ${opacityValue})`;
const aliases = {
  border: tokenColor('border'),
  input: tokenColor('border'),
  ring: tokenColor('info'),
  background: tokenColor('surface'),
  foreground: tokenColor('foreground'),
  primary: { DEFAULT: tokenColor('info'), foreground: tokenColor('primary-foreground') },
  secondary: { DEFAULT: tokenColor('surface-muted'), foreground: tokenColor('foreground') },
  destructive: { DEFAULT: tokenColor('danger-base'), foreground: tokenColor('primary-foreground') },
  muted: { DEFAULT: tokenColor('surface-muted'), foreground: tokenColor('text-muted') },
  accent: { DEFAULT: tokenColor('surface-muted'), foreground: tokenColor('foreground') },
  popover: { DEFAULT: tokenColor('surface'), foreground: tokenColor('foreground') },
  card: { DEFAULT: tokenColor('surface'), foreground: tokenColor('foreground') },
};
const aliasNames = new Set(Object.entries(aliases).flatMap(([name, value]) =>
  typeof value === 'string' ? [name]
    : Object.keys(value).map((part) => part === 'DEFAULT' ? name : `${name}-${part}`)));
const semanticColors = Object.fromEntries(Object.entries(tokens)
  .filter(([name, value]) => /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value) && !aliasNames.has(name))
  .map(([name]) => [name, semanticColor(name)]));
module.exports = {
  presets: [require('./tailwind.preset')],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: { ...semanticColors, ...aliases },
      borderRadius: {
        lg: "var(--admin-radius-md)",
        md: "calc(var(--admin-radius-md) - 2px)",
        sm: "calc(var(--admin-radius-md) - 4px)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

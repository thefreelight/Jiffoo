/** @type {import('tailwindcss').Config} */
const bridge = require('../../packages/shared/src/extensions/theme-bridge.json').admin;
const tokenColor = (role) => ({ opacityValue }) => opacityValue === undefined
  ? `var(--admin-${role})`
  : `color-mix(in srgb, var(--admin-${role}) calc(${opacityValue} * 100%), transparent)`;
const aliases = {
  border: tokenColor('border'), input: tokenColor('border'), ring: tokenColor('info'),
  background: tokenColor('background'), foreground: tokenColor('foreground'),
  primary: { DEFAULT: tokenColor('primary'), foreground: tokenColor('primary-foreground') },
  secondary: { DEFAULT: tokenColor('surface-muted'), foreground: tokenColor('foreground') },
  destructive: { DEFAULT: tokenColor('danger'), foreground: tokenColor('primary-foreground') },
  muted: { DEFAULT: tokenColor('surface-muted'), foreground: tokenColor('text-muted') },
  accent: { DEFAULT: tokenColor('surface-muted'), foreground: tokenColor('foreground') },
  popover: { DEFAULT: tokenColor('surface'), foreground: tokenColor('foreground') },
  card: { DEFAULT: tokenColor('surface'), foreground: tokenColor('foreground') },
};
const aliasNames = new Set(Object.keys(aliases));
const semanticColors = Object.fromEntries(Object.keys(bridge)
  .filter((name) => !name.startsWith('font-') && !name.startsWith('radius-') && !aliasNames.has(name))
  .map((name) => [name, tokenColor(name)]));
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

# @jiffoo/i18n

Internationalization (i18n) package for Jiffoo Mall applications.

[![npm version](https://img.shields.io/npm/v/@jiffoo/i18n)](https://www.npmjs.com/package/@jiffoo/i18n)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Description

A comprehensive internationalization solution for Jiffoo Mall built on top of `i18next` and `react-i18next`. Provides multi-language support with automatic locale detection, persistent language preferences, and a pre-built language switcher component.

## Installation

```bash
npm install @jiffoo/i18n
# or
pnpm add @jiffoo/i18n
# or
yarn add @jiffoo/i18n
```

## Prerequisites

- React 18+
- Node.js 18+

## Quick Start

### Provider Setup

Wrap your application with the `I18nProvider`:

```tsx
import { I18nProvider } from '@jiffoo/i18n';

function App() {
  return (
    <I18nProvider namespace="shop" defaultLocale="en">
      {/* Your app content */}
    </I18nProvider>
  );
}
```

**Provider Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `namespace` | `'shop' \| 'admin' \| 'super-admin'` | - | Required. Determines which translations to load |
| `defaultLocale` | `SupportedLocale` | `'en'` | Default language |
| `loadPath` | `string` | `/api/extensions/plugin/i18n/locales` | Path to load translation files |
| `children` | `ReactNode` | - | Child components |

## Usage

### Using the Translation Hook

```tsx
import { useI18n } from '@jiffoo/i18n';

function MyComponent() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div>
      <h1>{t('common.buttons.submit')}</h1>
      <p>Current language: {locale}</p>
      <button onClick={() => setLocale('zh')}>
        Switch to Chinese
      </button>
    </div>
  );
}
```

**Hook Returns:**

- `t(key, options?)` - Translation function
- `locale` - Current locale
- `setLocale(locale)` - Change language
- `isRTL` - Whether current locale is right-to-left

### Translation Examples

```tsx
import { useI18n } from '@jiffoo/i18n';

function Examples() {
  const { t } = useI18n();

  return (
    <div>
      {/* Simple translation */}
      <button>{t('common.buttons.save')}</button>

      {/* Translation with interpolation */}
      <p>{t('common.errors.min_length', { count: 8 })}</p>

      {/* Nested keys */}
      <span>{t('common.messages.save_success')}</span>

      {/* Time formatting */}
      <time>{t('common.time.hours_ago', { count: 2 })}</time>
    </div>
  );
}
```

### Language Switcher Component

Pre-built component for changing languages:

```tsx
import { LanguageSwitcher } from '@jiffoo/i18n';

function Header() {
  return (
    <header>
      {/* Dropdown variant (default) */}
      <LanguageSwitcher />

      {/* Button variant */}
      <LanguageSwitcher variant="buttons" />

      {/* Select variant */}
      <LanguageSwitcher variant="select" />

      {/* Customize display */}
      <LanguageSwitcher
        showFlag={true}
        showNativeName={true}
        className="my-custom-class"
      />
    </header>
  );
}
```

**LanguageSwitcher Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'dropdown' \| 'buttons' \| 'select'` | `'dropdown'` | Display style |
| `showFlag` | `boolean` | `true` | Show flag emoji |
| `showNativeName` | `boolean` | `true` | Show native language name |
| `className` | `string` | `''` | Custom CSS class |

## Supported Languages

The package supports the following languages:

| Code | Language | Native Name | Flag |
|------|----------|-------------|------|
| `en` | English | English | 🇺🇸 |
| `zh` | Chinese | 中文 | 🇨🇳 |
| `ja` | Japanese | 日本語 | 🇯🇵 |
| `ko` | Korean | 한국어 | 🇰🇷 |
| `es` | Spanish | Español | 🇪🇸 |
| `fr` | French | Français | 🇫🇷 |

**Currently Available Translations:** English (`en`) and Chinese (`zh`)

## Adding New Languages

### 1. Create Translation Files

Create a new directory in `packages/i18n/locales/` with your locale code:

```
packages/i18n/locales/
  └── fr/
      ├── common.json
      ├── shop.json
      ├── admin.json
      └── super-admin.json
```

### 2. Add Translation Keys

Follow the structure in `locales/en/common.json`:

```json
{
  "buttons": {
    "submit": "Soumettre",
    "cancel": "Annuler",
    "save": "Enregistrer"
  },
  "errors": {
    "required": "Ce champ est requis"
  }
}
```

### 3. Update Locale Exports

Add your locale to `index.ts`:

```typescript
import commonFr from './locales/fr/common.json';

export const locales = {
  en: { ... },
  zh: { ... },
  fr: {
    common: commonFr,
    // ... other namespaces
  }
};
```

### 4. Enable in Language Switcher

Update `LanguageSwitcher` component in `provider.tsx`:

```typescript
const availableLocales = SUPPORTED_LOCALES.filter(l =>
  ['en', 'zh', 'fr'].includes(l) // Add your locale
);
```

## Translation Namespaces

The package organizes translations into namespaces:

- **common** - Shared translations (buttons, errors, messages)
- **shop** - Shop frontend translations
- **admin** - Merchant dashboard translations
- **super-admin** - Super admin panel translations

## Features

- 🌍 **Multi-language Support** - 6 languages supported out of the box
- 🔄 **Automatic Detection** - Detects browser language on first visit
- 💾 **Persistent Preferences** - Saves language choice to localStorage
- 🎯 **Namespace Support** - Organize translations by app section
- 🪝 **React Hooks** - Simple `useI18n()` hook for translations
- 🎨 **Pre-built Components** - Ready-to-use language switcher
- 📦 **Lazy Loading** - Load translations on demand
- 🔌 **Framework Agnostic** - Built on i18next (works with any framework)

## API Reference

### Exports

```typescript
// Provider
export { I18nProvider }

// Hook
export { useI18n }

// Components
export { LanguageSwitcher }

// Constants
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES }

// Types
export type { SupportedLocale }

// Locales
export { locales }
```

### Constants

```typescript
// All supported locales
SUPPORTED_LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr']

// Default locale
DEFAULT_LOCALE = 'en'

// Locale display names with flags
LOCALE_NAMES = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  // ... more locales
}
```

## Example Usage in Different Apps

### Shop Frontend

```tsx
import { I18nProvider, useI18n } from '@jiffoo/i18n';

// App root
function ShopApp() {
  return (
    <I18nProvider namespace="shop">
      <Shop />
    </I18nProvider>
  );
}

// Component
function ProductCard() {
  const { t } = useI18n();

  return (
    <div>
      <button>{t('shop.add_to_cart')}</button>
      <button>{t('common.buttons.save')}</button>
    </div>
  );
}
```

### Admin Dashboard

```tsx
import { I18nProvider, LanguageSwitcher } from '@jiffoo/i18n';

function AdminApp() {
  return (
    <I18nProvider namespace="admin">
      <div>
        <header>
          <LanguageSwitcher variant="select" />
        </header>
        <AdminPanel />
      </div>
    </I18nProvider>
  );
}
```

## License

MIT © [Jiffoo Team](https://jiffoo.com)

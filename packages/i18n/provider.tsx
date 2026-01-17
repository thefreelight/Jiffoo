/**
 * I18n Provider Component
 * 
 * Provides internationalization context for React applications
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

// Supported locales
export const SUPPORTED_LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// Default locale
export const DEFAULT_LOCALE: SupportedLocale = 'en';

// Locale display names
export const LOCALE_NAMES: Record<SupportedLocale, { name: string; nativeName: string; flag: string }> = {
    en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
    zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
    es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' }
};

// I18n context type
interface I18nContextType {
    locale: SupportedLocale;
    setLocale: (locale: SupportedLocale) => void;
    t: (key: string, options?: Record<string, any>) => string;
    isRTL: boolean;
}

// Create context
const I18nContext = createContext<I18nContextType | null>(null);

// Storage key for locale preference
const LOCALE_STORAGE_KEY = 'jiffoo_locale';

// Detect browser locale
function detectBrowserLocale(): SupportedLocale {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;

    const browserLang = navigator.language.split('-')[0];
    if (SUPPORTED_LOCALES.includes(browserLang as SupportedLocale)) {
        return browserLang as SupportedLocale;
    }
    return DEFAULT_LOCALE;
}

// Get saved locale from storage
function getSavedLocale(): SupportedLocale | null {
    if (typeof window === 'undefined') return null;

    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.includes(saved as SupportedLocale)) {
        return saved as SupportedLocale;
    }
    return null;
}

// Provider props
interface I18nProviderProps {
    children: ReactNode;
    namespace: 'shop' | 'admin' | 'super-admin';
    defaultLocale?: SupportedLocale;
    loadPath?: string;
}

/**
 * I18n Provider Component
 */
export function I18nProvider({
    children,
    namespace,
    defaultLocale = DEFAULT_LOCALE,
    loadPath = '/api/plugins/i18n/locales'
}: I18nProviderProps) {
    const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize i18next
    useEffect(() => {
        const savedLocale = getSavedLocale() || detectBrowserLocale();
        setLocaleState(savedLocale);

        i18n
            .use(initReactI18next)
            .init({
                lng: savedLocale,
                fallbackLng: DEFAULT_LOCALE,
                ns: ['common', namespace],
                defaultNS: namespace,
                interpolation: {
                    escapeValue: false
                },
                react: {
                    useSuspense: false
                },
                backend: {
                    loadPath: `${loadPath}/{{lng}}/{{ns}}.json`
                },
                // Load resources directly for now (can be replaced with lazy loading)
                resources: {}
            })
            .then(() => {
                setIsInitialized(true);
            });
    }, [namespace, loadPath]);

    // Set locale and save to storage
    const setLocale = (newLocale: SupportedLocale) => {
        setLocaleState(newLocale);
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
        i18n.changeLanguage(newLocale);

        // Set document direction for RTL languages
        if (typeof document !== 'undefined') {
            document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
            document.documentElement.lang = newLocale;
        }
    };

    // Translation function
    const t = (key: string, options?: Record<string, any>): string => {
        return i18n.t(key, options);
    };

    // Check if current locale is RTL
    const isRTL = false; // Add RTL locales here if needed (e.g., 'ar', 'he')

    const contextValue: I18nContextType = {
        locale,
        setLocale,
        t,
        isRTL
    };

    if (!isInitialized) {
        return null; // Or a loading spinner
    }

    return (
        <I18nContext.Provider value={contextValue}>
            <I18nextProvider i18n={i18n}>
                {children}
            </I18nextProvider>
        </I18nContext.Provider>
    );
}

/**
 * useI18n Hook
 */
export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}

/**
 * Language Switcher Component
 */
interface LanguageSwitcherProps {
    variant?: 'dropdown' | 'buttons' | 'select';
    showFlag?: boolean;
    showNativeName?: boolean;
    className?: string;
}

export function LanguageSwitcher({
    variant = 'dropdown',
    showFlag = true,
    showNativeName = true,
    className = ''
}: LanguageSwitcherProps) {
    const { locale, setLocale } = useI18n();

    const availableLocales = SUPPORTED_LOCALES.filter(l =>
        ['en', 'zh'].includes(l) // Only show locales with translations
    );

    if (variant === 'buttons') {
        return (
            <div className={`flex gap-2 ${className}`}>
                {availableLocales.map(l => (
                    <button
                        key={l}
                        onClick={() => setLocale(l)}
                        className={`px-3 py-1 rounded ${locale === l
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                    >
                        {showFlag && LOCALE_NAMES[l].flag} {showNativeName ? LOCALE_NAMES[l].nativeName : LOCALE_NAMES[l].name}
                    </button>
                ))}
            </div>
        );
    }

    // Select variant
    return (
        <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as SupportedLocale)}
            className={`px-3 py-2 border rounded ${className}`}
        >
            {availableLocales.map(l => (
                <option key={l} value={l}>
                    {showFlag && LOCALE_NAMES[l].flag} {showNativeName ? LOCALE_NAMES[l].nativeName : LOCALE_NAMES[l].name}
                </option>
            ))}
        </select>
    );
}

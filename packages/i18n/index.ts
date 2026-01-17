/**
 * @jiffoo/i18n
 * 
 * Internationalization package for Jiffoo Mall
 */

export {
    I18nProvider,
    useI18n,
    LanguageSwitcher,
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_NAMES
} from './provider';
export type { SupportedLocale } from './provider';

// Import locales
import commonEn from './locales/en/common.json';
import commonZh from './locales/zh/common.json';
import shopEn from './locales/en/shop.json';
import shopZh from './locales/zh/shop.json';
import adminEn from './locales/en/admin.json';
import adminZh from './locales/zh/admin.json';

// Export locales
export const locales = {
    en: {
        common: commonEn,
        shop: shopEn,
        admin: adminEn,
            },
    zh: {
        common: commonZh,
        shop: shopZh,
        admin: adminZh,
            }
};

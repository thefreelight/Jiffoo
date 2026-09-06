/**
 * Extended use-translation hook for eSIM Mall theme
 * Matches eSIM Mall component expectations
 */

import { useParams } from 'next/navigation';
import { localize } from '../lib/i18n';
import type { Locale } from '../types';

export function useTranslation() {
    const params = useParams<{ locale?: string }>();
    const locale = ((params?.locale || 'en') as Locale);
    const t = (key: string, values?: Record<string, string | number>) => localize(locale, key, key, values);
    const tSync = t;

    return {
        currentLanguage: locale,
        isLoading: false,
        t,
        tSync,
    };
}

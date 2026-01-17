/**
 * Extended use-translation hook for yevbi theme
 * Matches yevbi component expectations
 */

export function useTranslation() {
    const t = (key: string, _params?: Record<string, string>) => key;
    const tSync = (key: string, _params?: Record<string, string>) => key;

    return {
        currentLanguage: 'en-US',
        setLanguage: (_lang: string) => { },
        isLoading: false,
        t,
        tSync,
    };
}

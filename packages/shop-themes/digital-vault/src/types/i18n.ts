export type Locale = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'fr' | 'de';

export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

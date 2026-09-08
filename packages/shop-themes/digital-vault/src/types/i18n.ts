export type Locale = 'en' | 'zh-Hans' | 'zh-Hant';

export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

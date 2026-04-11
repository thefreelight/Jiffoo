export type Locale = 'en' | 'zh-Hant';

export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

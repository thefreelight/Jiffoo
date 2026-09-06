/**
 * Universal theme translation chain.
 *
 * Resolution order for a key:
 * 1. the injected translator (`t`), usually provided by the official i18n
 *    plugin — a miss is `undefined` or a value identical to the key
 * 2. the theme's own message dictionary for the active locale
 * 3. the theme's message dictionary for the fallback locale (default `en`)
 *
 * `themeText()`/`translator.text()` add a final caller-provided literal so
 * components keep an inline default, mirroring the per-theme `themeText`
 * pattern that predates this shared implementation.
 */

export type ThemeMessages = Record<string, Record<string, string>>;

export type ThemeTranslationParams = Record<string, string | number>;

export type InjectedThemeTranslator = (
  key: string,
  params?: ThemeTranslationParams,
) => string | undefined;

export interface ThemeTranslatorOptions {
  /** Active locale code, e.g. `en`, `zh-Hans`, `zh-Hant`. */
  locale?: string | undefined;
  /** Theme message dictionary keyed by locale, then message key. */
  messages?: ThemeMessages | undefined;
  /** Runtime-injected translator, e.g. the i18n plugin's `t`. */
  t?: InjectedThemeTranslator | undefined;
  /** Locale consulted when the active locale has no entry. Default `en`. */
  fallbackLocale?: string | undefined;
}

export interface ThemeTranslator {
  /** Active locale the translator was created with. */
  readonly locale: string;
  /** Raw chain lookup; `undefined` on a full miss. */
  (key: string, params?: ThemeTranslationParams): string | undefined;
  /** Chain lookup with an inline fallback literal for full misses. */
  text(key: string, fallback: string, params?: ThemeTranslationParams): string;
}

export interface ThemeMessageParityReport {
  locale: string;
  /** Keys that exist in some other locale but are absent for this one. */
  missingKeys: string[];
}

function isInjectedMiss(value: string | undefined, key: string): boolean {
  return value === undefined || value === key;
}

/**
 * Replace `{name}` placeholders in a message template.
 */
export function interpolateThemeMessage(
  template: string,
  params?: ThemeTranslationParams,
): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (value, [name, replacement]) =>
      value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement)),
    template,
  );
}

/**
 * Resolve one key through injected `t` -> active-locale messages ->
 * fallback-locale messages. Interpolates params into the resolved theme
 * template; an injected translator result is returned as-is because the
 * injected implementation already applied its own interpolation.
 */
export function resolveThemeMessage(
  options: ThemeTranslatorOptions,
  key: string,
  params?: ThemeTranslationParams,
): string | undefined {
  const injected = options.t?.(key, params);
  if (!isInjectedMiss(injected, key)) return injected;

  const messages = options.messages;
  if (!messages) return undefined;
  const locale = options.locale ?? 'en';
  const fallbackLocale = options.fallbackLocale ?? 'en';
  const template = messages[locale]?.[key] ?? messages[fallbackLocale]?.[key];
  return template === undefined ? undefined : interpolateThemeMessage(template, params);
}

/**
 * One-shot chain lookup with an inline fallback, call-compatible with the
 * per-theme `themeText()` helpers written before this moved into the SDK.
 */
export function themeText(
  t: InjectedThemeTranslator | undefined,
  locale: string | undefined,
  key: string,
  fallback: string,
  params?: ThemeTranslationParams,
  messages?: ThemeMessages,
): string {
  const resolved = resolveThemeMessage({ t, locale, messages }, key, params);
  return resolved ?? interpolateThemeMessage(fallback, params);
}

/**
 * Create a reusable translator bound to one locale and message dictionary.
 */
export function createThemeTranslator(
  options: ThemeTranslatorOptions = {},
): ThemeTranslator {
  const locale = options.locale ?? 'en';
  const resolvedOptions: ThemeTranslatorOptions = { ...options, locale };
  const translate = (
    key: string,
    params?: ThemeTranslationParams,
  ): string | undefined => resolveThemeMessage(resolvedOptions, key, params);
  return Object.assign(translate, {
    locale,
    text: (key: string, fallback: string, params?: ThemeTranslationParams): string =>
      resolveThemeMessage(resolvedOptions, key, params) ??
      interpolateThemeMessage(fallback, params),
  });
}

/**
 * Compare message key sets across locales against the union of all keys.
 * A locale that misses a key silently renders its inline fallback string,
 * which is the drift this guard exists to catch in theme test suites.
 * Returns one report per locale that is missing keys; an empty array means
 * every locale carries every key.
 */
export function getThemeMessageParity(messages: ThemeMessages): ThemeMessageParityReport[] {
  const allKeys = new Set<string>();
  for (const dictionary of Object.values(messages)) {
    for (const key of Object.keys(dictionary)) {
      allKeys.add(key);
    }
  }
  const orderedKeys = [...allKeys].sort();
  const reports: ThemeMessageParityReport[] = [];
  for (const [locale, dictionary] of Object.entries(messages)) {
    const missingKeys = orderedKeys.filter((key) => dictionary[key] === undefined);
    if (missingKeys.length > 0) {
      reports.push({ locale, missingKeys });
    }
  }
  return reports;
}

/**
 * Translation Provider Abstraction
 *
 * Supports DeepL, OpenAI, and Google Translate.
 * No external npm dependencies -- uses native fetch (Node 18+).
 */

export interface TranslationProvider {
  name: string;
  translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]>;
}

// ============================================================================
// DeepL
// ============================================================================

class DeepLProvider implements TranslationProvider {
  name = 'deepl';
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPL_API_KEY || '';
    // Free key ends with ":fx", uses different endpoint
    this.apiUrl = this.apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';
  }

  async translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
    // DeepL supports up to 50 texts per request
    const results: string[] = [];
    for (let i = 0; i < texts.length; i += 50) {
      const chunk = texts.slice(i, i + 50);
      const params = new URLSearchParams();
      for (const t of chunk) params.append('text', t);
      params.append('source_lang', this.mapLang(sourceLang).toUpperCase());
      params.append('target_lang', this.mapLang(targetLang).toUpperCase());

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`DeepL API error ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as { translations: Array<{ text: string }> };
      results.push(...data.translations.map((t) => t.text));
    }
    return results;
  }

  private mapLang(locale: string): string {
    const map: Record<string, string> = { 'zh-Hant': 'ZH', 'zh-Hans': 'ZH', 'zh': 'ZH', 'en': 'EN', 'pt-BR': 'PT-BR', 'pt': 'PT-PT' };
    return map[locale] || locale;
  }
}

// ============================================================================
// OpenAI
// ============================================================================

class OpenAIProvider implements TranslationProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4o-mini';
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }

  async translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
    const results: string[] = [];
    // Process in chunks of 20 to fit context window
    for (let i = 0; i < texts.length; i += 20) {
      const chunk = texts.slice(i, i + 20);
      const numbered = chunk.map((t, idx) => `[${idx}] ${t}`).join('\n');

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a professional e-commerce translator. Translate the following texts from ${sourceLang} to ${targetLang}. Return a JSON object with numeric keys matching the input indices and translated values. Example: {"0":"translated text 0","1":"translated text 1"}. Preserve HTML tags, placeholders like {count}, and formatting.`,
            },
            { role: 'user', content: numbered },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      const content = data.choices[0]?.message?.content || '{}';

      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(content) as Record<string, string>;
      } catch {
        console.warn('[i18n] OpenAI returned invalid JSON, falling back to source texts');
      }

      for (let j = 0; j < chunk.length; j++) {
        results.push(parsed[String(j)] || chunk[j]);
      }
    }
    return results;
  }
}

// ============================================================================
// Google Translate
// ============================================================================

class GoogleTranslateProvider implements TranslationProvider {
  name = 'google';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || '';
  }

  async translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
    const results: string[] = [];
    // Google Translate API v2 supports batch
    for (let i = 0; i < texts.length; i += 100) {
      const chunk = texts.slice(i, i + 100);
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: chunk,
            source: this.mapLang(sourceLang),
            target: this.mapLang(targetLang),
            format: 'text',
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Google Translate API error ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as {
        data: { translations: Array<{ translatedText: string }> };
      };
      results.push(...data.data.translations.map((t) => t.translatedText));
    }
    return results;
  }

  private mapLang(locale: string): string {
    const map: Record<string, string> = { 'zh-Hant': 'zh-TW', 'zh-Hans': 'zh-CN' };
    return map[locale] || locale;
  }
}

// ============================================================================
// Registry
// ============================================================================

const PROVIDER_KEYS: Record<string, string> = {
  deepl: 'DEEPL_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_TRANSLATE_API_KEY',
};

const PROVIDERS: Record<string, () => TranslationProvider> = {
  deepl: () => new DeepLProvider(),
  openai: () => new OpenAIProvider(),
  google: () => new GoogleTranslateProvider(),
};

export function getProvider(name: string): TranslationProvider | null {
  const envKey = PROVIDER_KEYS[name];
  if (!envKey || !process.env[envKey]) return null;
  const factory = PROVIDERS[name];
  if (!factory) return null;
  return factory();
}

export function getAvailableProviders(): string[] {
  const envMap: Record<string, string> = {
    deepl: 'DEEPL_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_TRANSLATE_API_KEY',
  };
  return Object.entries(envMap)
    .filter(([, envKey]) => !!process.env[envKey])
    .map(([name]) => name);
}

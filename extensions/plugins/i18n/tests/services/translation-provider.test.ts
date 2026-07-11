import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

// Mock global fetch
vi.stubGlobal('fetch', fetchMock);

// We need to dynamically import after env vars are set, so we import the
// module functions here and rely on env var changes + fresh provider instances.
import { getProvider, getAvailableProviders } from '../../src/services/translation-provider';

describe('translation-provider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all provider-related env vars before each test
    delete process.env.DEEPL_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TRANSLATION_MODEL;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // getAvailableProviders
  // ==========================================================================

  describe('getAvailableProviders', () => {
    it('returns empty array when no keys set', () => {
      const providers = getAvailableProviders();
      expect(providers).toEqual([]);
    });

    it('DeepL available when DEEPL_API_KEY is set', () => {
      process.env.DEEPL_API_KEY = 'test-deepl-key';

      const providers = getAvailableProviders();
      expect(providers).toContain('deepl');
    });

    it('OpenAI available when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const providers = getAvailableProviders();
      expect(providers).toContain('openai');
    });

    it('Google available when GOOGLE_TRANSLATE_API_KEY is set', () => {
      process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

      const providers = getAvailableProviders();
      expect(providers).toContain('google');
    });

    it('returns all providers when all keys are set', () => {
      process.env.DEEPL_API_KEY = 'test-deepl-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

      const providers = getAvailableProviders();
      expect(providers).toEqual(['deepl', 'openai', 'google']);
    });
  });

  // ==========================================================================
  // getProvider
  // ==========================================================================

  describe('getProvider', () => {
    it('returns null for unknown provider name', () => {
      const provider = getProvider('unknown');
      expect(provider).toBeNull();
    });

    it('returns null when the provider env key is not set', () => {
      const provider = getProvider('deepl');
      expect(provider).toBeNull();
    });

    it('returns provider object with name and translateBatch', () => {
      process.env.DEEPL_API_KEY = 'test-deepl-key';

      const provider = getProvider('deepl');
      expect(provider).not.toBeNull();
      expect(provider!.name).toBe('deepl');
      expect(typeof provider!.translateBatch).toBe('function');
    });
  });

  // ==========================================================================
  // DeepL provider translateBatch
  // ==========================================================================

  describe('DeepL provider translateBatch', () => {
    it('calls DeepL API with correct URL and headers', async () => {
      process.env.DEEPL_API_KEY = 'test-deepl-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ text: 'Bonjour' }],
        }),
      });

      const provider = getProvider('deepl')!;
      await provider.translateBatch(['Hello'], 'en', 'fr');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.deepl.com/v2/translate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'DeepL-Auth-Key test-deepl-key',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('uses free API URL for keys ending with :fx', async () => {
      process.env.DEEPL_API_KEY = 'test-key:fx';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ text: 'Bonjour' }],
        }),
      });

      const provider = getProvider('deepl')!;
      await provider.translateBatch(['Hello'], 'en', 'fr');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api-free.deepl.com/v2/translate',
        expect.anything()
      );
    });

    it('handles language code mapping (zh-Hant -> ZH, pt-BR -> PT-BR)', async () => {
      process.env.DEEPL_API_KEY = 'test-deepl-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ text: 'Translated' }],
        }),
      });

      const provider = getProvider('deepl')!;
      await provider.translateBatch(['Test'], 'zh-Hant', 'pt-BR');

      const callArgs = fetchMock.mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('source_lang=ZH');
      expect(body).toContain('target_lang=PT-BR');
    });

    it('returns translated texts array', async () => {
      process.env.DEEPL_API_KEY = 'test-deepl-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [
            { text: 'Bonjour' },
            { text: 'Au revoir' },
          ],
        }),
      });

      const provider = getProvider('deepl')!;
      const result = await provider.translateBatch(['Hello', 'Goodbye'], 'en', 'fr');

      expect(result).toEqual(['Bonjour', 'Au revoir']);
    });

    it('throws on API error', async () => {
      process.env.DEEPL_API_KEY = 'test-deepl-key';

      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const provider = getProvider('deepl')!;
      await expect(provider.translateBatch(['Hello'], 'en', 'fr')).rejects.toThrow(
        'DeepL API error 403'
      );
    });
  });

  // ==========================================================================
  // OpenAI provider translateBatch
  // ==========================================================================

  describe('OpenAI provider translateBatch', () => {
    it('calls OpenAI API with correct model and system prompt', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: JSON.stringify({ '0': 'Bonjour' }) } },
          ],
        }),
      });

      const provider = getProvider('openai')!;
      await provider.translateBatch(['Hello'], 'en', 'fr');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openai-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('from en to fr');
    });

    it('parses JSON response with indexed keys', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ '0': 'Bonjour', '1': 'Au revoir' }),
              },
            },
          ],
        }),
      });

      const provider = getProvider('openai')!;
      const result = await provider.translateBatch(['Hello', 'Goodbye'], 'en', 'fr');

      expect(result).toEqual(['Bonjour', 'Au revoir']);
    });

    it('returns translated texts array', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ '0': 'Hola', '1': 'Mundo' }),
              },
            },
          ],
        }),
      });

      const provider = getProvider('openai')!;
      const result = await provider.translateBatch(['Hello', 'World'], 'en', 'es');

      expect(result).toEqual(['Hola', 'Mundo']);
    });

    it('falls back to source text on invalid JSON response', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: 'not valid json' } },
          ],
        }),
      });

      const provider = getProvider('openai')!;
      const result = await provider.translateBatch(['Hello'], 'en', 'fr');

      // Falls back to original text
      expect(result).toEqual(['Hello']);
    });

    it('throws on API error', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      const provider = getProvider('openai')!;
      await expect(provider.translateBatch(['Hello'], 'en', 'fr')).rejects.toThrow(
        'OpenAI API error 429'
      );
    });
  });

  // ==========================================================================
  // Google provider translateBatch
  // ==========================================================================

  describe('Google provider translateBatch', () => {
    it('calls Google Translate API with correct params', async () => {
      process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: 'Bonjour' }],
          },
        }),
      });

      const provider = getProvider('google')!;
      await provider.translateBatch(['Hello'], 'en', 'fr');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://translation.googleapis.com/language/translate/v2?key=test-google-key',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.q).toEqual(['Hello']);
      expect(body.source).toBe('en');
      expect(body.target).toBe('fr');
      expect(body.format).toBe('text');
    });

    it('handles language code mapping (zh-Hant -> zh-TW)', async () => {
      process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: 'Translated' }],
          },
        }),
      });

      const provider = getProvider('google')!;
      await provider.translateBatch(['Test'], 'zh-Hant', 'zh-Hans');

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.source).toBe('zh-TW');
      expect(body.target).toBe('zh-CN');
    });

    it('returns translated texts array', async () => {
      process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            translations: [
              { translatedText: 'Bonjour' },
              { translatedText: 'Au revoir' },
            ],
          },
        }),
      });

      const provider = getProvider('google')!;
      const result = await provider.translateBatch(['Hello', 'Goodbye'], 'en', 'fr');

      expect(result).toEqual(['Bonjour', 'Au revoir']);
    });

    it('throws on API error', async () => {
      process.env.GOOGLE_TRANSLATE_API_KEY = 'test-google-key';

      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      const provider = getProvider('google')!;
      await expect(provider.translateBatch(['Hello'], 'en', 'fr')).rejects.toThrow(
        'Google Translate API error 400'
      );
    });
  });
});

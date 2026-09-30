import { describe, expect, it } from 'vitest';
import {
  mergeSecretConfigForUpdate,
  sanitizePluginConfigForAdmin,
} from '@/core/admin/plugin-management/config-secrets';
import { encryptPluginConfig } from '@/core/admin/plugin-management/config-crypto';

describe('plugin config secret helpers', () => {
  const manifest = {
    configSchema: {
      type: 'object',
      properties: {
        legacySecret: { type: 'string', sensitive: true },
        sensitiveSecret: { type: 'string', sensitive: true },
        visibleField: { type: 'string' },
      },
    },
  };

  it('sanitizes encrypted sensitive string fields for admin responses', () => {
    const result = sanitizePluginConfigForAdmin(manifest, encryptPluginConfig(manifest, {
      legacySecret: 'legacy-value',
      sensitiveSecret: 'sensitive-value',
      visibleField: 'visible',
    }));

    expect(result.config).toEqual({
      legacySecret: '',
      sensitiveSecret: '',
      visibleField: 'visible',
    });
    expect(result.configMeta?.secretFields).toEqual({
      legacySecret: { configured: true },
      sensitiveSecret: { configured: true },
    });
  });

  it('marks plaintext sensitive fields unconfigured without exposing their values', () => {
    const result = sanitizePluginConfigForAdmin(manifest, {
      legacySecret: 'legacy-value',
      sensitiveSecret: 'sensitive-value',
    });
    expect(result.config).toEqual({ legacySecret: '', sensitiveSecret: '' });
    expect(result.configMeta?.secretFields).toEqual({
      legacySecret: { configured: false },
      sensitiveSecret: { configured: false },
    });
  });

  it('preserves configured sensitive values when admin submits blanks', () => {
    const result = mergeSecretConfigForUpdate(
      manifest,
      { legacySecret: 'legacy-value', sensitiveSecret: 'sensitive-value', visibleField: 'old' },
      { legacySecret: '', sensitiveSecret: '', visibleField: 'new' },
    );

    expect(result).toEqual({
      legacySecret: 'legacy-value',
      sensitiveSecret: 'sensitive-value',
      visibleField: 'new',
    });
  });
});

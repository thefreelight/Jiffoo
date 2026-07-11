import { describe, expect, it } from 'vitest';
import {
  mergeSecretConfigForUpdate,
  sanitizePluginConfigForAdmin,
} from '@/core/admin/plugin-management/config-secrets';

describe('plugin config secret helpers', () => {
  const manifest = {
    configSchema: {
      legacySecret: { type: 'secret' },
      sensitiveSecret: { type: 'string', sensitive: true },
      visibleField: { type: 'string' },
    },
  };

  it('sanitizes legacy secret and sensitive string fields for admin responses', () => {
    const result = sanitizePluginConfigForAdmin(manifest, {
      legacySecret: 'legacy-value',
      sensitiveSecret: 'sensitive-value',
      visibleField: 'visible',
    });

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

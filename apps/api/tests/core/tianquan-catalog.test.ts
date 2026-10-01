import { describe, expect, it } from 'vitest';
import { getOfficialCatalogEntry } from '@/core/admin/market/official-catalog';

describe('Tianquan official catalog entries', () => {
  it('exposes the published Tianquan theme', () => {
    expect(getOfficialCatalogEntry('tianquan')).toMatchObject({
      kind: 'theme',
      version: '0.0.5',
      packageUrl: 'https://artifacts.jiffoo.com/official-artifacts/themes/tianquan/0.0.5.jtheme',
    });
  });

  it('exposes the published SMTP email plugin', () => {
    expect(getOfficialCatalogEntry('smtp-email')).toMatchObject({
      kind: 'plugin',
      version: '0.0.5',
      packageUrl: 'https://artifacts.jiffoo.com/official-artifacts/plugins/smtp-email/0.0.5.jplugin',
    });
  });
});

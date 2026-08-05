import { describe, expect, it } from 'vitest';

import { getOfficialCatalogEntry } from '@/core/admin/market/official-catalog';

describe('RemoteRadar official catalog seed', () => {
  it('exposes the published free theme package to self-hosted instances', () => {
    expect(getOfficialCatalogEntry('remoteradar')).toMatchObject({
      slug: 'remoteradar',
      kind: 'theme',
      target: 'shop',
      version: '0.0.11',
      defaultPricingModel: 'free',
      packageUrl: 'https://artifacts.jiffoo.com/official-artifacts/themes/remoteradar/0.0.11.jtheme',
    });
  });
});

import { describe, expect, it } from 'vitest';

import { getOfficialCatalogEntry } from '@/core/admin/market/official-catalog';

describe('RemoteRadar official catalog seed', () => {
  it('exposes the published free theme package to self-hosted instances', () => {
    expect(getOfficialCatalogEntry('remoteradar')).toMatchObject({
      slug: 'remoteradar',
      kind: 'theme',
      target: 'shop',
      version: '0.0.12',
      defaultPricingModel: 'free',
      packageUrl: 'https://artifacts.jiffoo.com/official-artifacts/themes/remoteradar/0.0.12.jtheme',
    });
  });

  it('keeps every entry\'s version in step with the package it points at', () => {
    // Version bumps of other entries were once applied by search-and-replace and
    // left these two pointing at packages that do not exist.
    for (const slug of ['tianquan', 'remoteradar']) {
      const entry = getOfficialCatalogEntry(slug)!;
      expect(entry.packageUrl, slug).toMatch(new RegExp(`/${slug}/${entry.version.replace(/\./g, '\\.')}\\.jtheme$`));
    }
  });
});

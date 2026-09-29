import { describe, expect, it } from 'vitest';
import { providerInitPlan } from '../lib/storefront-providers';
import { resolveProviderLibraryOverrides } from '../lib/provider-library-overrides.mjs';

const now = new Date('2026-09-29T00:00:00Z');
const empty = { ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null };
const ids = { ga4MeasurementId: 'G-A /?', metaPixelId: '123 /?', baiduSiteKey: 'abc /?' };
const steps = [
  { provider: 'ga4', url: 'https://www.googletagmanager.com/gtag/js?id=G-A%20%2F%3F', commands: [['js', now], ['config', ids.ga4MeasurementId]] },
  { provider: 'meta', url: 'https://connect.facebook.net/en_US/fbevents.js', commands: [['init', ids.metaPixelId], ['track', 'PageView']] },
  { provider: 'baidu', url: 'https://hm.baidu.com/hm.js?abc%20%2F%3F', commands: [] },
];

describe('Storefront provider base code', () => {
  it('A plans exact commands and encoded library URLs for each provider and GA4 Meta Baidu together', () => {
    expect(providerInitPlan(empty, {}, now)).toEqual([]);
    for (const [index, key] of (Object.keys(ids) as Array<keyof typeof ids>).entries()) {
      expect(providerInitPlan({ ...empty, [key]: ids[key] }, {}, now)).toEqual([steps[index]]);
    }
    expect(providerInitPlan(ids, {}, now)).toEqual(steps);
  });

  it('B honors only local server overrides and otherwise uses the real provider URLs', () => {
    const overrides = { ga4: 'data:text/javascript,void%200', meta: 'http://127.0.0.1:3003/meta.js', baidu: 'https://[::1]/baidu.js' };
    for (const origin of ['http://localhost:3003', 'http://127.0.0.1:3003', 'http://[::1]:3003']) {
      const resolved = resolveProviderLibraryOverrides(JSON.stringify(overrides), origin);
      expect(resolved).toEqual(overrides);
      expect(providerInitPlan(ids, resolved, now)).toEqual(steps.map((step) => ({
        ...step, url: overrides[step.provider as keyof typeof overrides],
      })));
    }
    for (const origin of [undefined, '', 'https://shop.example', 'http://localhost.example', 'file://localhost/shop']) {
      expect(() => resolveProviderLibraryOverrides(JSON.stringify(overrides), origin)).toThrow('loopback STOREFRONT_URL');
    }
    for (const value of ['https://remote.example/library.js', 'javascript:alert(1)', 'file:///library.js']) {
      expect(() => resolveProviderLibraryOverrides(JSON.stringify({ ga4: value }), 'http://localhost:3003')).toThrow('loopback');
    }
    for (const value of ['', 'null', '[]', '{"unknown":"data:,x"}', '{"ga4":1}']) {
      expect(() => resolveProviderLibraryOverrides(value, 'http://localhost:3003')).toThrow('loopback');
    }
    expect(resolveProviderLibraryOverrides(undefined, undefined)).toEqual({});
    expect(providerInitPlan(ids, resolveProviderLibraryOverrides(undefined, 'https://shop.example'), now)).toEqual(steps);
  });
});

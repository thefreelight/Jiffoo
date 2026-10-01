/**
 * Tests for public page SEO metadata (P1-1 acceptance lock).
 *
 * Locks the contract: every indexable public route emits a unique title and
 * description, a self-declared canonical, hreflang alternates for both
 * locales, and an OG locale that matches the page language.
 */

import { describe, expect, it } from 'vitest';
import { generatePublicPageMetadata, homeJsonLd, organizationJsonLd } from '@/lib/seo/public-page-metadata';

const ORIGIN = 'https://remoteradar.cc/';

describe('generatePublicPageMetadata', () => {
  it('emits a unique title and description per route', () => {
    const home = generatePublicPageMetadata({ route: 'home', locale: 'en', origin: ORIGIN });
    const pricing = generatePublicPageMetadata({ route: 'pricing', locale: 'en', origin: ORIGIN });
    const privacy = generatePublicPageMetadata({ route: 'privacy', locale: 'en', origin: ORIGIN });
    expect(home.title).not.toBe(pricing.title);
    expect(pricing.title).not.toBe(privacy.title);
    expect(home.description).not.toBe(pricing.description);
  });

  it('emits self canonical and both-locale hreflang alternates', () => {
    const pricing = generatePublicPageMetadata({ route: 'pricing', locale: 'en', origin: ORIGIN });
    expect(pricing.alternates?.canonical).toBe('https://remoteradar.cc/en/pricing');
    const languages = pricing.alternates?.languages as Record<string, string> | undefined;
    expect(languages?.en).toBe('https://remoteradar.cc/en/pricing');
    expect(languages?.['zh-Hant']).toBe('https://remoteradar.cc/zh-Hant/pricing');
  });

  it('localizes the description and OG locale for zh-Hant', () => {
    const zh = generatePublicPageMetadata({ route: 'pricing', locale: 'zh-Hant', origin: ORIGIN });
    const en = generatePublicPageMetadata({ route: 'pricing', locale: 'en', origin: ORIGIN });
    expect(zh.description).not.toBe(en.description);
    expect(zh.openGraph?.locale).toBe('zh_TW');
    expect(en.openGraph?.locale).toBe('en_US');
  });

  it('uses summary_large_image twitter cards and per-page OG urls', () => {
    const page = generatePublicPageMetadata({ route: 'help', locale: 'en', origin: ORIGIN });
    expect(page.twitter?.card).toBe('summary_large_image');
    expect(page.openGraph?.url).toBe('https://remoteradar.cc/en/help');
  });

  it('emits WebSite and Organization JSON-LD for the home page', () => {
    const website = JSON.parse(homeJsonLd(ORIGIN));
    const org = JSON.parse(organizationJsonLd(ORIGIN));
    expect(website['@type']).toBe('WebSite');
    expect(org['@type']).toBe('Organization');
    expect(String(website.url)).toContain('remoteradar.cc');
  });
});

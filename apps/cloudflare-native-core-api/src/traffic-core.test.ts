import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Traffic collection core (pure half): what a beacon keeps, how hosts match
// rules, which channel a visit belongs to, machine and device detection, day
// ranges, the per-month visitor key, and the mirror guard that keeps the
// native and Node copies identical.
import {
  EMPTY_TRAFFIC_RULES,
  TRAFFIC_CHANNELS,
  classifyTraffic,
  looksLikeTrafficBot,
  normalizeTrafficHost,
  normalizeTrafficReferrer,
  parseTrafficPageview,
  parseTrafficPeriod,
  parseTrafficRules,
  trafficClientCountry,
  trafficClientIp,
  trafficDayKey,
  trafficDevice,
  trafficHostMatches,
  trafficOriginHost,
  trafficVisitorKey,
  type TrafficAcquisition,
  type TrafficChannel,
  type TrafficChannelRules,
} from './traffic-core';
import { DEFAULT_TRAFFIC_RULES } from './traffic-default-rules';

const OWN_HOST = 'www.bokmoo.com';

const acquisition = (overrides: Partial<TrafficAcquisition> = {}): TrafficAcquisition => ({
  referrerHost: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  clickIds: [],
  ...overrides,
});

const RULES_DOCUMENT = {
  version: 1,
  ai: ['ChatGPT.com', 'chatgpt', 'perplexity.ai'],
  search: ['google.*', 'baidu.com', 'bing.com'],
  searchExclude: ['mail.google.*'],
  social: ['facebook.com', 'x.com'],
  email: ['mail.google.*'],
  paidMediums: ['cpc', 'Paid_Search'],
  paidClickParams: ['gclid', 'msclkid'],
  emailMediums: ['email'],
  socialMediums: ['social', 'social-media'],
};

const rules = (): TrafficChannelRules => {
  const parsed = parseTrafficRules(RULES_DOCUMENT);
  if (parsed === null) throw new Error('fixture rules must parse');
  return parsed;
};

describe('normalizeTrafficHost', () => {
  it('lowercases and drops a trailing root dot', () => {
    expect(normalizeTrafficHost('WWW.Bokmoo.com.')).toBe('www.bokmoo.com');
    expect(normalizeTrafficHost('esim.bokmoo.com')).toBe('esim.bokmoo.com');
  });

  it('rejects anything that is not a plain hostname', () => {
    expect(normalizeTrafficHost('https://www.bokmoo.com')).toBeNull();
    expect(normalizeTrafficHost('www bokmoo.com')).toBeNull();
    expect(normalizeTrafficHost('www_bokmoo.com')).toBeNull();
    expect(normalizeTrafficHost('-bokmoo.com')).toBeNull();
    expect(normalizeTrafficHost('a'.repeat(254))).toBeNull();
    expect(normalizeTrafficHost(42)).toBeNull();
    expect(normalizeTrafficHost(null)).toBeNull();
  });
});

describe('normalizeTrafficReferrer', () => {
  it('keeps only the hostname of an http(s) referrer', () => {
    expect(normalizeTrafficReferrer('https://www.google.com/search?q=esim#top', OWN_HOST)).toBe('google.com');
    expect(normalizeTrafficReferrer('http://www.perplexity.ai/search/abc?utm_source=x', OWN_HOST)).toBe('perplexity.ai');
    expect(normalizeTrafficReferrer('https://chatgpt.com/c/1a2b', OWN_HOST)).toBe('chatgpt.com');
  });

  it('does not treat the site itself as a source', () => {
    expect(normalizeTrafficReferrer('https://www.bokmoo.com/en/cart', OWN_HOST)).toBeNull();
    expect(normalizeTrafficReferrer('https://bokmoo.com/en', OWN_HOST)).toBeNull();
    // A sibling storefront host on the same site is still the site itself.
    expect(normalizeTrafficReferrer('https://esim.bokmoo.com/plans', OWN_HOST)).toBeNull();
    expect(normalizeTrafficReferrer('https://www.notbokmoo.com/x', OWN_HOST)).toBe('notbokmoo.com');
  });

  it('keeps the site a link in an Android app points at', () => {
    expect(
      normalizeTrafficReferrer('android-app://com.google.android.googlequicksearchbox/https/www.google.com', OWN_HOST),
    ).toBe('google.com');
    expect(normalizeTrafficReferrer('android-app://com.google.android.gm/https/mail.google.com', OWN_HOST)).toBe('mail.google.com');
    expect(normalizeTrafficReferrer('android-app://com.example.app', OWN_HOST)).toBeNull();
  });

  it('drops referrers it cannot read or that are not web pages', () => {
    expect(normalizeTrafficReferrer('', OWN_HOST)).toBeNull();
    expect(normalizeTrafficReferrer('android-app://com.google.android.gm', OWN_HOST)).toBeNull();
    expect(normalizeTrafficReferrer('javascript:alert(1)', OWN_HOST)).toBeNull();
    expect(normalizeTrafficReferrer('about:blank', OWN_HOST)).toBeNull();
    expect(normalizeTrafficReferrer('not a url', OWN_HOST)).toBeNull();
    expect(normalizeTrafficReferrer(null, OWN_HOST)).toBeNull();
  });
});

describe('trafficHostMatches', () => {
  it('matches a host and its subdomains', () => {
    expect(trafficHostMatches('facebook.com', ['facebook.com'])).toBe(true);
    expect(trafficHostMatches('m.facebook.com', ['facebook.com'])).toBe(true);
    expect(trafficHostMatches('facebook.com.evil.io', ['facebook.com'])).toBe(false);
    expect(trafficHostMatches('notfacebook.com', ['facebook.com'])).toBe(false);
  });

  it('matches a top-level-domain family but not look-alikes', () => {
    expect(trafficHostMatches('google.com', ['google.*'])).toBe(true);
    expect(trafficHostMatches('www.google.co.uk', ['google.*'])).toBe(true);
    expect(trafficHostMatches('images.google.de', ['google.*'])).toBe(true);
    expect(trafficHostMatches('googleusercontent.com', ['google.*'])).toBe(false);
    expect(trafficHostMatches('notgoogle.com', ['google.*'])).toBe(false);
    expect(trafficHostMatches('google.complex.io', ['google.*'])).toBe(false);
  });

  it('compares bare tokens exactly', () => {
    expect(trafficHostMatches('chatgpt', ['chatgpt', 'claude'])).toBe(true);
    expect(trafficHostMatches('xchatgpt', ['chatgpt'])).toBe(false);
    expect(trafficHostMatches('chatgpt.com', ['chatgpt'])).toBe(false);
    expect(trafficHostMatches('anything', [])).toBe(false);
  });
});

describe('parseTrafficRules', () => {
  it('accepts a well-formed document and normalises every entry', () => {
    expect(rules()).toEqual({
      version: 1,
      ai: ['chatgpt.com', 'chatgpt', 'perplexity.ai'],
      search: ['google.*', 'baidu.com', 'bing.com'],
      searchExclude: ['mail.google.*'],
      social: ['facebook.com', 'x.com'],
      email: ['mail.google.*'],
      paidMediums: ['cpc', 'paid_search'],
      paidClickParams: ['gclid', 'msclkid'],
      emailMediums: ['email'],
      socialMediums: ['social', 'social-media'],
    });
  });

  it('removes duplicates inside a list', () => {
    expect(parseTrafficRules({ ...RULES_DOCUMENT, social: ['x.com', 'X.com', 'x.com'] })?.social).toEqual(['x.com']);
  });

  it('rejects documents that are not usable as rules', () => {
    const bad = (patch: Record<string, unknown>) => parseTrafficRules({ ...RULES_DOCUMENT, ...patch });
    expect(parseTrafficRules(null)).toBeNull();
    expect(parseTrafficRules('rules')).toBeNull();
    expect(bad({ version: 0 })).toBeNull();
    expect(bad({ version: '1' })).toBeNull();
    expect(bad({ version: 1.5 })).toBeNull();
    expect(bad({ ai: 'chatgpt' })).toBeNull();
    expect(bad({ ai: [1] })).toBeNull();
    expect(bad({ ai: ['not a host'] })).toBeNull();
    expect(bad({ ai: ['goo*gle'] })).toBeNull();
    expect(bad({ ai: ['google.**'] })).toBeNull();
    expect(bad({ ai: ['a'.repeat(81)] })).toBeNull();
    expect(bad({ ai: [''] })).toBeNull();
    expect(bad({ ai: new Array(601).fill('x.com') })).toBeNull();
    expect(bad({ ai: new Array(600).fill('a.com'), search: new Array(600).fill('b.com') })).not.toBeNull();
  });
});

describe('parseTrafficPageview', () => {
  it('keeps the fields of a landing pageview and drops everything else from its address', () => {
    expect(
      parseTrafficPageview(
        {
          h: 'WWW.Bokmoo.com',
          p: '/en/products/esim-japan?utm_source=Newsletter&utm_medium=Email&utm_campaign=BF-2026&utm_content=&utm_term=%20&fbclid=x&msclkid=2&gclid=1&not-a-known-param=1#reviews',
          r: 'https://www.google.com/search?q=esim',
          w: 390,
        },
        'fallback.example',
      ),
    ).toEqual({
      host: 'www.bokmoo.com',
      path: '/en/products/esim-japan',
      referrerHost: 'google.com',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'BF-2026',
      utmContent: null,
      utmTerm: null,
      // In the tracker's fixed order, whatever order the address had.
      clickIds: 'gclid,msclkid,fbclid',
      viewportWidth: 390,
      zoneOffsetMinutes: null,
    });
  });

  it('reads the viewer’s zone offset when the tracker sends one', () => {
    expect(parseTrafficPageview({ p: '/', z: 480 }, OWN_HOST)?.zoneOffsetMinutes).toBe(480);
    expect(parseTrafficPageview({ p: '/', z: -300 }, OWN_HOST)?.zoneOffsetMinutes).toBe(-300);
    expect(parseTrafficPageview({ p: '/', z: 900 }, OWN_HOST)?.zoneOffsetMinutes).toBeNull();
    expect(parseTrafficPageview({ p: '/', z: '480' }, OWN_HOST)?.zoneOffsetMinutes).toBeNull();
  });

  it('uses the caller-supplied host when the beacon carries none', () => {
    const pageview = parseTrafficPageview({ p: '/' }, 'shop.example.com');
    expect(pageview?.host).toBe('shop.example.com');
    expect(parseTrafficPageview({ p: '/' }, 'not a host')).toBeNull();
  });

  it('rejects beacons without a usable path', () => {
    expect(parseTrafficPageview({ h: 'www.bokmoo.com' }, 'www.bokmoo.com')).toBeNull();
    expect(parseTrafficPageview({ p: 'en/products' }, 'www.bokmoo.com')).toBeNull();
    expect(parseTrafficPageview({ p: '//evil.example/x' }, 'www.bokmoo.com')).toBeNull();
    expect(parseTrafficPageview({ p: 'https://evil.example/' }, 'www.bokmoo.com')).toBeNull();
    expect(parseTrafficPageview({ p: '/a/b\u0000c' }, 'www.bokmoo.com')).toBeNull();
    expect(parseTrafficPageview({ p: '/' + 'a'.repeat(2048) }, 'www.bokmoo.com')).toBeNull();
    expect(parseTrafficPageview('pageview', 'www.bokmoo.com')).toBeNull();
    expect(parseTrafficPageview(null, 'www.bokmoo.com')).toBeNull();
  });

  it('ignores malformed optional fields instead of failing the pageview', () => {
    const beacon = parseTrafficPageview(
      { p: `/?utm_source=${'a'.repeat(201)}&utm_medium=%00&gclid`, w: '390', r: '   ' },
      'www.bokmoo.com',
    );
    expect(beacon).toMatchObject({ utmSource: null, utmMedium: null, clickIds: 'gclid', viewportWidth: null, referrerHost: null });
    expect(parseTrafficPageview({ p: '/', w: -5 }, 'www.bokmoo.com')?.viewportWidth).toBeNull();
  });
});

describe('classifyTraffic', () => {
  const cases: [string, TrafficAcquisition, TrafficChannel][] = [
    ['a paid click id wins over everything', acquisition({ referrerHost: 'chatgpt.com', clickIds: ['gclid'] }), 'paid'],
    ['a paid medium', acquisition({ utmSource: 'ad', utmMedium: 'cpc' }), 'paid'],
    ['an AI assistant referrer', acquisition({ referrerHost: 'chatgpt.com' }), 'ai'],
    ['an AI assistant named by utm_source', acquisition({ utmSource: 'chatgpt' }), 'ai'],
    ['an AI assistant named by a host-like utm_source', acquisition({ utmSource: 'www.perplexity.ai' }), 'ai'],
    ['AI beats a search referrer on the same visit', acquisition({ referrerHost: 'google.com', utmSource: 'perplexity.ai' }), 'ai'],
    ['a search engine referrer', acquisition({ referrerHost: 'www.google.co.uk' }), 'search'],
    ['a Chinese search engine referrer', acquisition({ referrerHost: 'm.baidu.com' }), 'search'],
    ['a search host on the exclude list is not search', acquisition({ referrerHost: 'mail.google.com' }), 'email'],
    ['an e-mail medium', acquisition({ utmSource: 'nov', utmMedium: 'email' }), 'email'],
    ['a social medium', acquisition({ utmSource: 'ig', utmMedium: 'social-media' }), 'social'],
    ['a social referrer', acquisition({ referrerHost: 'mobile.x.com' }), 'social'],
    ['tagged traffic that fits no list', acquisition({ utmSource: 'partner', utmMedium: 'referral' }), 'campaign'],
    ['a campaign name alone', acquisition({ utmCampaign: 'spring' }), 'campaign'],
    ['any other external site', acquisition({ referrerHost: 'news.example.org' }), 'referral'],
    ['no referrer and no tags', acquisition(), 'direct'],
  ];

  it.each(cases)('%s', (_name, input, expected) => {
    expect(classifyTraffic(input, rules())).toBe(expected);
  });

  it('knows no market lists on its own', () => {
    expect(classifyTraffic(acquisition({ referrerHost: 'chatgpt.com' }), EMPTY_TRAFFIC_RULES)).toBe('referral');
    expect(classifyTraffic(acquisition({ utmMedium: 'cpc' }), EMPTY_TRAFFIC_RULES)).toBe('campaign');
  });

  it('always answers with a declared channel', () => {
    for (const channel of TRAFFIC_CHANNELS) expect(TRAFFIC_CHANNELS).toContain(channel);
    expect(classifyTraffic(acquisition({ referrerHost: 'unknown.example', utmSource: 'x' }), rules())).toBe('campaign');
  });
});

describe('looksLikeTrafficBot', () => {
  it('recognises crawlers, fetchers and tooling', () => {
    const machines = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); ChatGPT-User/1.0; +https://openai.com/bot',
      'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
      'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 DuckDuckGo/7.172.1 FBIS/2.1 WebKit/17621.2.10.10.12 Mobile/15E148 Bot/1.0',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko; Google Page Speed Insights) Chrome/120.0.0.0 Safari/537.36',
      'curl/8.4.0',
      'Python-urllib/3.11',
      '',
      'x'.repeat(600),
    ];
    for (const agent of machines) expect(looksLikeTrafficBot(agent)).toBe(true);
  });

  it('keeps real people, including in-app browsers', () => {
    const people = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44(0x18002c2f) NetType/WIFI Language/zh_CN',
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.23.24.14',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FB_IAB/FB4A;FBAV/445.0.0.32.118;]',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ];
    for (const agent of people) expect(looksLikeTrafficBot(agent)).toBe(false);
  });
});

describe('trafficDevice', () => {
  const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const iPad = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const androidTablet = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  it('lets the viewport decide when the tracker sent one', () => {
    expect(trafficDevice(desktop, 390)).toBe('mobile');
    expect(trafficDevice(desktop, 900)).toBe('tablet');
    expect(trafficDevice(desktop, 1440)).toBe('desktop');
  });

  it('falls back to the user agent', () => {
    expect(trafficDevice(iPad, null)).toBe('tablet');
    expect(trafficDevice(androidTablet, null)).toBe('tablet');
    expect(trafficDevice(iphone, null)).toBe('mobile');
    expect(trafficDevice(desktop, null)).toBe('desktop');
    expect(trafficDevice('curl/8.4.0', null)).toBe('other');
  });
});

describe('day keys and periods', () => {
  const BEIJING = 480;

  it('buckets by the viewer’s zone', () => {
    expect(trafficDayKey(Date.UTC(2026, 10, 27, 16, 0, 0), BEIJING)).toBe(20261128);
    expect(trafficDayKey(Date.UTC(2026, 10, 27, 15, 59, 59), BEIJING)).toBe(20261127);
    expect(trafficDayKey(Date.UTC(2026, 10, 27, 15, 59, 59), 0)).toBe(20261127);
  });

  it('converts whole days to a half-open millisecond range', () => {
    expect(parseTrafficPeriod('20261128', '20261128', BEIJING)).toEqual([
      Date.UTC(2026, 10, 27, 16),
      Date.UTC(2026, 10, 28, 16),
    ]);
    expect(parseTrafficPeriod('2026-11-28', '2026-11-30', 0)).toEqual([Date.UTC(2026, 10, 28), Date.UTC(2026, 11, 1)]);
    // A zone west of UTC: its 31 October starts five hours after the UTC day.
    expect(parseTrafficPeriod('20261031', '20261101', -300)).toEqual([
      Date.UTC(2026, 9, 31, 5),
      Date.UTC(2026, 10, 2, 5),
    ]);
  });

  it('refuses periods it cannot honour', () => {
    expect(parseTrafficPeriod('20260231', '20260301', 0)).toBeNull();
    expect(parseTrafficPeriod('20261128', '20261101', 0)).toBeNull();
    expect(parseTrafficPeriod('20250101', '20261231', 0)).toBeNull();
    expect(parseTrafficPeriod('abc', '20261101', 0)).toBeNull();
    expect(parseTrafficPeriod('2026-1-1', '2026-11-01', 0)).toBeNull();
    expect(parseTrafficPeriod(undefined, null, 0)).toBeNull();
  });
});

describe('trafficVisitorKey', () => {
  const secret = 'unit-test-secret';
  const january = Date.UTC(2026, 0, 15);
  const february = Date.UTC(2026, 1, 15);

  it('is stable for the same visitor within a month', async () => {
    const first = await trafficVisitorKey(secret, '203.0.113.7', 'Mozilla/5.0 (iPhone)', january);
    const second = await trafficVisitorKey(secret, '203.0.113.7', 'Mozilla/5.0 (iPhone)', january + 60_000);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
  });

  it('changes with the month, the address, the agent and the secret', async () => {
    const base = await trafficVisitorKey(secret, '203.0.113.7', 'Mozilla/5.0 (iPhone)', january);
    expect(await trafficVisitorKey(secret, '203.0.113.7', 'Mozilla/5.0 (iPhone)', february)).not.toBe(base);
    expect(await trafficVisitorKey(secret, '203.0.113.8', 'Mozilla/5.0 (iPhone)', january)).not.toBe(base);
    expect(await trafficVisitorKey(secret, '203.0.113.7', 'Mozilla/5.0 (iPad)', january)).not.toBe(base);
    expect(await trafficVisitorKey('other-secret', '203.0.113.7', 'Mozilla/5.0 (iPhone)', january)).not.toBe(base);
  });

  it('never contains the address it was derived from', async () => {
    const key = await trafficVisitorKey(secret, '203.0.113.7', 'Mozilla/5.0', january);
    expect(key).not.toContain('203');
  });
});

describe('request headers', () => {
  const headers = (map: Record<string, string>) => (name: string) => map[name.toLowerCase()] ?? null;

  it('takes the address the storefront proxy saw first, then the edge header', () => {
    expect(trafficClientIp(headers({ 'x-jiffoo-client-ip': '203.0.113.9', 'cf-connecting-ip': '2a06:98c0:3600::103' }))).toBe('203.0.113.9');
    expect(trafficClientIp(headers({ 'cf-connecting-ip': '203.0.113.8' }))).toBe('203.0.113.8');
    expect(trafficClientIp(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(trafficClientIp(headers({}))).toBe('unknown');
  });

  it('reads a two-letter country code and nothing else', () => {
    expect(trafficClientCountry(headers({ 'x-jiffoo-client-country': 'cn', 'cf-ipcountry': 'US' }))).toBe('CN');
    expect(trafficClientCountry(headers({ 'cf-ipcountry': 'us' }))).toBe('US');
    expect(trafficClientCountry(headers({ 'cf-ipcountry': 'XX' }))).toBe('XX');
    expect(trafficClientCountry(headers({ 'cf-ipcountry': '1' }))).toBeNull();
    expect(trafficClientCountry(headers({}))).toBeNull();
  });

  it('accepts a beacon only from the storefront that sent it', () => {
    const SHOP = 'https://www.bokmoo.com';
    expect(trafficOriginHost(SHOP, null, 'same-origin')).toBe('www.bokmoo.com');
    expect(trafficOriginHost(SHOP, 'www.bokmoo.com', null)).toBe('www.bokmoo.com');
    expect(trafficOriginHost(SHOP, 'api.bokmoo.com', null)).toBeNull();
    expect(trafficOriginHost(SHOP, 'www.bokmoo.com', 'cross-site')).toBeNull();
    expect(trafficOriginHost(null, null, null)).toBeNull();
    expect(trafficOriginHost('', null, null)).toBeNull();
    expect(trafficOriginHost('chrome-extension://abc', null, null)).toBeNull();
    expect(trafficOriginHost('https://evil.example', null, null)).toBe('evil.example');
  });
});

describe('default channel rules', () => {
  it('are a valid rules document', () => {
    expect(parseTrafficRules(DEFAULT_TRAFFIC_RULES)).toEqual(DEFAULT_TRAFFIC_RULES);
  });

  it('sort the referrers merchants ask about into the right channel', () => {
    const of = (referrerHost: string): TrafficChannel => classifyTraffic(acquisition({ referrerHost }), DEFAULT_TRAFFIC_RULES);
    expect(of('chatgpt.com')).toBe('ai');
    expect(of('www.perplexity.ai')).toBe('ai');
    expect(of('gemini.google.com')).toBe('ai');
    expect(of('copilot.microsoft.com')).toBe('ai');
    expect(of('claude.ai')).toBe('ai');
    expect(of('www.doubao.com')).toBe('ai');
    expect(of('kimi.moonshot.cn')).toBe('ai');
    expect(of('yuanbao.tencent.com')).toBe('ai');
    expect(of('www.google.co.uk')).toBe('search');
    expect(of('www.baidu.com')).toBe('search');
    expect(of('cn.bing.com')).toBe('search');
    expect(of('www.sogou.com')).toBe('search');
    expect(of('mail.google.com')).toBe('email');
    expect(of('translate.google.com')).toBe('referral');
    expect(of('www.facebook.com')).toBe('social');
    expect(of('x.com')).toBe('social');
    expect(of('news.ycombinator.com')).toBe('social');
    expect(of('unknown.example.org')).toBe('referral');
    expect(classifyTraffic(acquisition({ utmSource: 'chatgpt' }), DEFAULT_TRAFFIC_RULES)).toBe('ai');
    expect(classifyTraffic(acquisition({ utmSource: 'nl', utmMedium: 'newsletter' }), DEFAULT_TRAFFIC_RULES)).toBe('email');
    expect(classifyTraffic(acquisition({ utmSource: 'bing', utmMedium: 'cpc' }), DEFAULT_TRAFFIC_RULES)).toBe('paid');
    expect(classifyTraffic(acquisition({ clickIds: ['msclkid'] }), DEFAULT_TRAFFIC_RULES)).toBe('paid');
  });
});

describe('mirror guard', () => {
  const nodeCopy = (file: string) => readFileSync(new URL(`../../api/src/core/traffic/${file}`, import.meta.url), 'utf8');

  it('keeps the native and Node copies of the traffic core identical', () => {
    expect(nodeCopy('traffic-core.ts')).toBe(readFileSync(new URL('./traffic-core.ts', import.meta.url), 'utf8'));
  });

  it('keeps the native and Node copies of the default channel rules identical', () => {
    expect(nodeCopy('traffic-default-rules.ts')).toBe(
      readFileSync(new URL('./traffic-default-rules.ts', import.meta.url), 'utf8'),
    );
  });
});

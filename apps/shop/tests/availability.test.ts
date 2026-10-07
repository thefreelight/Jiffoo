import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { availabilityResponse, classifyAvailability, resolveAvailabilityReads, retryDeadline, safeRetryTarget, ShopAvailability } from '../lib/availability';

it('B4 theme package 503 follows the existing availability deadline and retains its typed code', async () => {
  for (const code of ['THEME_PACKAGE_UNAVAILABLE', 'THEME_PACKAGE_MATERIALIZATION_TIMEOUT']) {
    const error = await classifyAvailability(new Response(JSON.stringify({ error: { code } }), { status: 503, headers: { 'Retry-After': '5' } }), 1000);
    expect(error).toMatchObject({ status: 503, code, retryAt: 6000 });
  }
});

it('O parses Retry-After, preserves absolute deadlines and waits for the latest parallel failure', async () => {
  const now = Date.parse('Mon, 05 Oct 2026 06:00:00 GMT');
  expect(retryDeadline('12', now)).toBe(now + 12000);
  expect(retryDeadline('Mon, 05 Oct 2026 06:00:20 GMT', now)).toBe(now + 20000);
  expect(retryDeadline('Mon, 05 Oct 2026 05:00:00 GMT', now)).toBe(now);
  for (const value of [null, '', '-1', '1.5', 'Infinity', 'tomorrow', 'Tue, 05 Oct 2026 06:00:20 GMT']) expect(retryDeadline(value, now)).toBe(now + 5000);
  const response = new Response(JSON.stringify({ error: { code: 'SHARED_PROTECTION_UNAVAILABLE', message: 'private upstream detail', details: { retryAt: now + 23000 } } }), { status: 503, headers: { 'Retry-After': '24' } });
  const classified = await classifyAvailability(response, now);
  expect(classified).toMatchObject({ status: 503, code: 'SHARED_PROTECTION_UNAVAILABLE', retryAt: now + 23000 });
  expect(classified?.message).not.toContain('private');
  expect(await response.json()).toHaveProperty('error.message', 'private upstream detail');
  let release!: () => void;
  const latch = new Promise<void>((resolve) => { release = resolve; });
  const reads = resolveAvailabilityReads([Promise.reject(new ShopAvailability(429, 'RATE_LIMITED', now + 1000)), latch.then(() => { throw classified; })] as const);
  release();
  await expect(reads).rejects.toBe(classified);
  await expect(resolveAvailabilityReads([Promise.reject(new Error('unknown'))])).rejects.toThrow('unknown');
  expect(await classifyAvailability(new Response(null, { status: 500 }), now)).toBeNull();
});

it('O availability HTML is localized, isolated and permits only safe GET retry targets', async () => {
  const origin = 'https://shop.example';
  for (const target of ['//evil.example', 'https://evil.example/en', '/availability', '/bff/auth/logout', '/en/../availability', '/en/products/%2fhost', '/\\evil', '/en#fragment', 'https://user:pass@shop.example/en']) expect(safeRetryTarget(target, origin), target).toBe('/');
  expect(safeRetryTarget('/zh-Hans/products/item?q=book', origin)).toBe('/zh-Hans/products/item?q=book');
  const now = 100000;
  for (const [locale, title] of [['en', 'Shop temporarily unavailable'], ['zh-Hans', '商店暂时不可用'], ['zh-Hant', '商店暫時無法使用']]) {
    const response = availabilityResponse(new Request(`${origin}/availability?locale=${locale}&status=503&retryAt=${now + 5000}&returnTo=%2Fen%2Fproducts&message=private`), now);
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('5');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
    const html = await response.text();
    expect(html).toContain(title);
    expect(html).toContain('disabled');
    expect(html).toContain('src="/availability.js"');
    expect(html).not.toMatch(/private|<script>|google|facebook|baidu/);
  }
  const expired = await availabilityResponse(new Request(`${origin}/availability?status=429&retryAt=0&returnTo=%2Fen`), now).text();
  expect(expired).toContain('href="/en"');
  expect(expired).not.toContain('disabled');
  expect(availabilityResponse(new Request(`${origin}/availability`, { method: 'POST' })).status).toBe(405);
});

it('O the local retry control waits for its deadline and navigates only on user activation', () => {
  let now = 100000;
  let tick!: () => void;
  let click!: (event: { preventDefault: () => void }) => void;
  const navigations: string[] = [];
  const wait = { dataset: { deadline: '105000', target: '/en/products', template: 'Try again in {seconds} seconds.' }, textContent: '' };
  class Button { disabled = true; addEventListener(_event: string, handler: typeof click) { click = handler; } }
  const button = new Button();
  runInNewContext(readFileSync(new URL('../public/availability.js', import.meta.url), 'utf8'), {
    document: { getElementById: (id: string) => id === 'wait' ? wait : button },
    Date: { now: () => now }, Math, Number,
    HTMLButtonElement: Button,
    setTimeout: (handler: () => void) => { tick = handler; return 1; },
    window: { location: { assign: (target: string) => navigations.push(target) } },
  });
  expect(button.disabled).toBe(true);
  click({ preventDefault: () => {} });
  expect(navigations).toEqual([]);
  now = 105000;
  tick();
  expect(button.disabled).toBe(false);
  expect(navigations).toEqual([]);
  click({ preventDefault: () => {} });
  expect(navigations).toEqual(['/en/products']);
});

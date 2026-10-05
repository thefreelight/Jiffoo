import { isShopLocale, type ShopLocale } from './locale';

export type AvailabilityStatus = 429 | 503;
export class ShopAvailability extends Error {
  constructor(readonly status: AvailabilityStatus, readonly code: string, readonly retryAt: number) {
    super('The shop is temporarily unavailable');
  }
  retryAfter(now = Date.now()): number { return Math.max(0, Math.ceil((this.retryAt - now) / 1000)); }
}

export function retryDeadline(value: string | null, now = Date.now()): number {
  const text = value?.trim() ?? '';
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    const deadline = now + seconds * 1000;
    if (Number.isSafeInteger(seconds) && Number.isSafeInteger(deadline) && deadline <= 8640000000000000) return deadline;
  }
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)) {
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed) && new Date(parsed).toUTCString() === text) return Math.max(now, parsed);
  }
  return now + 5000;
}

export async function classifyAvailability(response: Response, now = Date.now()): Promise<ShopAvailability | null> {
  if (response.status !== 429 && response.status !== 503) return null;
  let code = response.status === 429 ? 'RATE_LIMITED' : 'SHOP_TEMPORARILY_UNAVAILABLE';
  let retryAt = retryDeadline(response.headers.get('Retry-After'), now);
  try {
    const body = await response.clone().json() as { error?: { code?: unknown; details?: { retryAt?: unknown } } };
    if (typeof body.error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(body.error.code)) code = body.error.code;
    const deadline = body.error?.details?.retryAt;
    if (typeof deadline === 'number' && Number.isSafeInteger(deadline) && deadline >= 0 && deadline <= 8640000000000000) retryAt = Math.max(now, deadline);
  } catch { /* Response details are intentionally not exposed. */ }
  return new ShopAvailability(response.status, code, retryAt);
}

export async function resolveAvailabilityReads<T extends readonly unknown[]>(reads: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
  const results = await Promise.allSettled(reads);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  const unknown = failures.find((result) => !(result.reason instanceof ShopAvailability));
  if (unknown) throw unknown.reason;
  const availability = failures.map((result) => result.reason as ShopAvailability);
  if (availability.length) throw availability.reduce((latest, next) => next.retryAt > latest.retryAt ? next : latest);
  return results.map((result) => (result as PromiseFulfilledResult<unknown>).value) as unknown as T;
}

const safePage = /^\/(?:en|zh-Hans|zh-Hant)(?:\/(?:products(?:\/[^/]+)?|categories\/[^/]+|search|login|register|forgot-password|reset-password|verify-email|cart|account(?:\/orders(?:\/[^/]+)?)?|checkout(?:\/(?:complete|return|cancel))?))?\/?$/;
export function safeRetryTarget(value: string | null, origin: string): string {
  if (!value || /[\\\r\n\0]/.test(value) || /%(?:2f|5c|00|0d|0a)/i.test(value)) return '/';
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.username || url.password || url.hash || (url.pathname !== '/' && !safePage.test(url.pathname))) return '/';
    return url.pathname + url.search;
  } catch { return '/'; }
}

export const availabilityText: Record<ShopLocale, { limited: string; unavailable: string; description: string; wait: string; retry: string; noScript: string }> = {
  en: { limited: 'Too many requests', unavailable: 'Shop temporarily unavailable', description: 'Please try again in a moment. Your submitted work has not been replayed.', wait: 'Try again in {seconds} seconds.', retry: 'Try again', noScript: 'After the waiting period, reload this page to enable retry.' },
  'zh-Hans': { limited: '请求过于频繁', unavailable: '商店暂时不可用', description: '请稍后再试。系统不会自动重新提交您的操作。', wait: '{seconds} 秒后可以重试。', retry: '再试一次', noScript: '等待结束后，请刷新此页以启用重试。' },
  'zh-Hant': { limited: '請求過於頻繁', unavailable: '商店暫時無法使用', description: '請稍後再試。系統不會自動重新提交您的操作。', wait: '{seconds} 秒後可以重試。', retry: '再試一次', noScript: '等待結束後，請重新整理此頁以啟用重試。' },
};

export function availabilityMessage(error: ShopAvailability, locale: ShopLocale, now = Date.now()): string {
  const text = availabilityText[locale];
  return `${error.status === 429 ? text.limited : text.unavailable}. ${text.wait.replace('{seconds}', String(error.retryAfter(now)))}`;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export function availabilityResponse(request: Request, now = Date.now()): Response {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  const url = new URL(request.url);
  const target = safeRetryTarget(url.searchParams.get('returnTo'), url.origin);
  const requestedLocale = url.searchParams.get('locale') ?? target.split('/')[1];
  const locale = isShopLocale(requestedLocale) ? requestedLocale : 'en';
  const status = url.searchParams.get('status') === '429' ? 429 : 503;
  const requestedCode = url.searchParams.get('code') ?? '';
  const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(requestedCode) ? requestedCode : status === 429 ? 'RATE_LIMITED' : 'SHOP_TEMPORARILY_UNAVAILABLE';
  const requestedDeadline = Number(url.searchParams.get('retryAt'));
  const retryAt = url.searchParams.has('retryAt') && Number.isSafeInteger(requestedDeadline) && requestedDeadline >= 0 && requestedDeadline <= 8640000000000000 ? requestedDeadline : now + 5000;
  const retry = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const text = availabilityText[locale];
  const title = status === 429 ? text.limited : text.unavailable;
  const control = retry ? `<button id="retry" type="button" disabled>${escapeHtml(text.retry)}</button>` : `<a id="retry" role="button" href="${escapeHtml(target)}">${escapeHtml(text.retry)}</a>`;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/availability.css"><script src="/availability.js" defer></script></head><body><main><p class="eyebrow">JIFFOO</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text.description)}</p><p id="wait" role="status" data-template="${escapeHtml(text.wait)}" data-deadline="${retryAt}" data-target="${escapeHtml(target)}">${escapeHtml(text.wait.replace('{seconds}', String(retry)))}</p>${control}<noscript><p>${escapeHtml(text.noScript)}</p></noscript></main></body></html>`;
  return new Response(html, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': String(retry),
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Shop-Availability-Code': code,
  } });
}

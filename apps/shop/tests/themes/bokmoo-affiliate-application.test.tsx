import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { AffiliatePage } from '@shop-themes/bokmoo/src/components/AffiliatePage';
import { AFFILIATE, affiliateErrorText, commissionStatusText, memberRoleText, scopeText } from '@shop-themes/bokmoo/src/lib/affiliate-copy';
import { cardName } from '@shop-themes/bokmoo/src/lib/card-copy';

// The owner's direction (2026-11-27): "顾客自己后台不能创建机构，机构只能由我们后台创建，或者客户前端申请，留下联系方式，我们审批"
// and "后台要设置可以适用的推广产品吧？不是全站的". Until now the storefront let a shopper open an organization on their own,
// and the affiliate page was written in English only, whatever language the storefront was in.

const LOCALES = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'] as const;
type Locale = (typeof LOCALES)[number];
const text = (container: HTMLElement) => (container.textContent ?? '').replace(/\s+/g, ' ');

const PARTNER = {
  id: 'p-1', userId: 'u-1', code: 'CREATOR10', status: 'active', displayName: 'Sam', commissionRate: 10, currency: 'USD',
  scopeMode: 'all', scopeProductIds: [],
};
const APPLICATION = {
  id: 'app-1', organizationName: 'Travel Crew', contactName: 'Sam', email: 'sam@example.com', phone: '+86 138 0000 0000',
  website: 'https://travelcrew.example', message: 'We run a travel channel.', status: 'pending', reviewNote: null,
  organizationId: null, createdAt: '2026-11-27T02:00:00.000Z', reviewedAt: null,
};
const ORGANIZATION = {
  id: 'org-1', ownerUserId: 'u-1', code: 'ORG-1A2B3C4D', name: 'Travel Crew', status: 'active', commissionRate: 6, currency: 'USD',
  members: [
    { id: 'm-1', userId: 'u-1', role: 'OWNER', status: 'active', joinedAt: '', username: 'sam', email: 'sam@example.com' },
    { id: 'm-2', userId: 'u-2', role: 'INFLUENCER', status: 'active', joinedAt: '', username: 'kim', email: 'kim@example.com' },
  ],
};

type Options = {
  partner?: Record<string, unknown> | null;
  commissions?: unknown[];
  organization?: Record<string, unknown> | null;
  application?: Record<string, unknown> | null;
  submit?: { status: number; body: unknown };
  // a guest session (the core answers 403 SIGN_IN_REQUIRED), a screenshot the account sent, and how an upload is answered
  guest?: boolean;
  screenshot?: null;
  upload?: { status: number; body: unknown };
};

/** The affiliate endpoints, as the core answers them; `null` is "not found" (404). */
function stubAffiliate(options: Options = {}) {
  // the screenshot goes by XMLHttpRequest, past the storefront's fetch wrapper: a stand-in that records it and answers
  type Sent = { url: string; method: string; body: unknown; file?: File | null; authorization?: string };
  const calls: Sent[] = [];
  class StandInRequest {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    timeout = 0;
    status = 0;
    responseText = '';
    private record!: Sent;
    private authorization = '';
    open(method: string, url: string) { calls.push({ url, method, body: undefined }); this.record = calls[calls.length - 1]!; }
    setRequestHeader(name: string, value: string) { if (name === 'Authorization') this.authorization = value; }
    send(body: unknown) {
      this.record.file = body instanceof FormData ? (body.get('file') as File | null) : null;
      this.record.authorization = this.authorization;
      const refused = options.upload && options.upload.status >= 400 ? options.upload : null;
      setTimeout(() => {
        this.status = refused ? refused.status : 200;
        this.responseText = JSON.stringify(refused ? { success: false, error: refused.body } : { success: true, data: { uploaded: true } });
        this.onload?.();
      }, 0);
    }
  }
  vi.stubGlobal('XMLHttpRequest', StandInRequest);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined, file: init?.body instanceof FormData ? (init.body.get('file') as File | null) : undefined });
    const reply = (status: number, data: unknown, error?: { code: string; message: string }) => (
      { ok: status < 400, status, json: async () => (error ? { success: false, error } : { success: true, data }), blob: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], { type: 'image/png' }) }
    );
    const missing = (code: string, message: string) => reply(404, null, { code, message });
    if (options.guest) return reply(403, null, { code: 'SIGN_IN_REQUIRED', message: 'Sign in to use the affiliate workspace' });
    if (url.endsWith('/organizations/applications/screenshot')) {
      if (method === 'POST') {
        return options.upload
          ? reply(options.upload.status, options.upload.body, options.upload.status >= 400 ? options.upload.body as { code: string; message: string } : undefined)
          : reply(200, { uploaded: true });
      }
      return options.screenshot === null ? missing('SCREENSHOT_NOT_FOUND', 'No screenshot was sent') : reply(200, null);
    }
    if (options.guest) return reply(403, null, { code: 'SIGN_IN_REQUIRED', message: 'Sign in to use the affiliate workspace' });
    if (url.endsWith('/organizations/applications/screenshot')) {
      if (method === 'POST') {
        return options.upload
          ? reply(options.upload.status, options.upload.body, options.upload.status >= 400 ? options.upload.body as { code: string; message: string } : undefined)
          : reply(200, { uploaded: true });
      }
      return options.screenshot === null ? missing('SCREENSHOT_NOT_FOUND', 'No screenshot was sent') : reply(200, null);
    }
    if (method === 'POST' && url.endsWith('/organizations/applications')) {
      return options.submit
        ? reply(options.submit.status, options.submit.body, options.submit.status >= 400 ? options.submit.body as { code: string; message: string } : undefined)
        : reply(201, APPLICATION);
    }
    if (url.endsWith('/partners/me')) return options.partner === null ? missing('AFFILIATE_PARTNER_NOT_FOUND', 'Affiliate partner not found') : reply(200, options.partner ?? PARTNER);
    if (url.endsWith('/organizations/commissions')) return reply(200, { items: [] });
    if (url.endsWith('/commissions')) return reply(200, { items: options.commissions ?? [] });
    if (url.endsWith('/organizations/me')) return options.organization === null ? missing('ORGANIZATION_NOT_FOUND', 'Organization not found') : reply(200, options.organization ?? ORGANIZATION);
    if (url.endsWith('/organizations/applications/mine')) return options.application === null ? missing('APPLICATION_NOT_FOUND', 'No application found') : reply(200, options.application ?? APPLICATION);
    throw new Error(`unexpected request ${method} ${url}`);
  }));
  return calls;
}

const renderPage = (locale: Locale | undefined, isAuthenticated = true) => render(
  <AffiliatePage
    isLoading={false} isAuthenticated={isAuthenticated} locale={locale as never}
    onNavigateBack={vi.fn()} onNavigateToLogin={vi.fn()}
  />,
);
const openOrganizationTab = async () => {
  fireEvent.click(screen.getByRole('button', { name: '机构' }));
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('创作者网络。'));
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

describe('the affiliate workspace speaks the storefront language', () => {
  it('every line is written in all seven languages', () => {
    for (const [key, copy] of Object.entries(AFFILIATE)) {
      // the copy table names the two Chinese scripts the way pickCopy does
      for (const locale of ['en', 'hans', 'hant', 'ja', 'ko', 'fr', 'de'] as const) expect(copy[locale], `${key} (${locale})`).toBeTruthy();
    }
  });

  const TITLE: Record<Locale, string> = {
    en: 'Affiliate workspace', 'zh-Hans': '推广中心', 'zh-Hant': '推廣中心', ja: 'アフィリエイト画面', ko: '제휴 센터', fr: 'Espace d’affiliation', de: 'Partnerbereich',
  };
  for (const locale of LOCALES) {
    it(`asks a visitor who is not signed in to sign in, in ${locale}`, () => {
      const { container } = renderPage(locale, false);
      expect(text(container)).toContain(TITLE[locale]);
    });
  }

  it('the partner page in Chinese carries no English', async () => {
    stubAffiliate({ commissions: [{ id: 'c-1', orderId: 'BM202611270001', amount: 3.5, currency: 'USD', status: 'pending' }] });
    const { container } = renderPage('zh-Hans');
    await waitFor(() => expect(container.querySelector('[data-purpose="partner-scope"]')).toBeTruthy());
    const page = text(container);
    for (const chinese of ['推广伙伴', '机构', '你的推荐收益。', '复制链接', 'USD 3.50', '累计收益', '10%', '佣金比例', '1', '订单', '你的推广码适用于全部商品。', '推广佣金', '待结算']) {
      expect(page).toContain(chinese);
    }
    for (const english of ['Your referral', 'Copy link', 'Personal affiliate', 'Partner commissions', 'No commissions yet', 'earned', 'Pending', /(?<![A-Za-z])rate(?![A-Za-z])/]) {
      expect(page).not.toContain(english);
    }
  });

  it('a partner without an account registers in Chinese', async () => {
    stubAffiliate({ partner: null });
    const { container } = renderPage('zh-Hans');
    await waitFor(() => expect(container.querySelector('[data-purpose="affiliate-register-form"]')).toBeTruthy());
    expect(screen.getByRole('button', { name: '创建推广账号' })).toBeTruthy();
    expect(screen.getByLabelText('显示名称')).toBeTruthy();
    expect(screen.getByLabelText('机构代码（选填）')).toBeTruthy();
  });

  it('names roles, statuses and a refused request in the shopper’s language', () => {
    expect(memberRoleText('zh-Hans', 'OWNER')).toBe('所有者');
    expect(memberRoleText('ja', 'INFLUENCER')).toBe('クリエイター');
    expect(memberRoleText('de', 'MANAGER')).toBe('Manager');
    expect(commissionStatusText('ko', 'paid')).toBe('지급 완료');
    expect(commissionStatusText('fr', 'REVERSED')).toBe('Annulée');
    expect(affiliateErrorText('zh-Hans', { code: 'APPLICATION_PENDING', message: 'Your application is waiting for review' })).toBe('申请审核中');
    expect(affiliateErrorText('zh-Hant', { code: 'USER_ALREADY_ORGANIZED', message: 'This account already belongs to an organization' })).toBe('該帳戶已屬於一個機構。');
    expect(affiliateErrorText('en', { code: 'SOMETHING_NEW', message: 'Passed on as it came' })).toBe('Passed on as it came');
    expect(affiliateErrorText('en', undefined)).toBe('');
  });
});

describe('a code reaches what the store let it reach', () => {
  const CARD = cardName({ id: 'odoo-product-6' }, 'zh-Hans')!;
  const BLUETOOTH = cardName({ id: 'odoo-product-7' }, 'zh-Hans')!;

  it('says so in words: everything, the picked products, or everything but them', () => {
    expect(scopeText('zh-Hans', PARTNER)).toBe('你的推广码适用于全部商品。');
    // the store's own cards are named; a core that predates scopes says "everything"
    expect(scopeText('zh-Hans', { ...PARTNER, scopeMode: 'selected', scopeProductIds: ['odoo-product-7', 'odoo-product-6'] })).toBe(`你的推广码仅适用于${BLUETOOTH}、${CARD}。`);
    expect(scopeText('en', { ...PARTNER, scopeMode: 'selected', scopeProductIds: ['odoo-product-7'] })).toBe(`Your code applies to ${cardName({ id: 'odoo-product-7' }, 'en')} only.`);
    expect(scopeText('fr', { ...PARTNER, scopeMode: 'selected', scopeProductIds: ['odoo-product-7', 'odoo-product-6'] })).toBe(`Votre code ne s’applique qu’à : ${cardName({ id: 'odoo-product-7' }, 'fr')}, ${cardName({ id: 'odoo-product-6' }, 'fr')}.`);
    // anything else is counted
    expect(scopeText('zh-Hans', { ...PARTNER, scopeMode: 'except', scopeProductIds: ['boss-JP-1GB-7D', 'boss-KR-3GB-7D'] })).toBe('你的推广码适用于全部商品，2 件商品除外。');
    expect(scopeText('en', { ...PARTNER, scopeMode: 'except', scopeProductIds: ['boss-JP-1GB-7D'] })).toBe('Your code applies to every product except 1 product.');
    expect(scopeText('ja', { scopeMode: 'nonsense', scopeProductIds: ['x'] })).toBe('あなたのコードはすべての商品に使えます。');
    expect(scopeText('de', { ...PARTNER, scopeMode: 'except', scopeProductIds: ['boss-JP-1GB-7D', 'boss-KR-3GB-7D'] })).toBe('Ihr Code gilt für alle Produkte außer: 2 Produkte.');
    expect(scopeText('en', null)).toBe('Your code applies to every product.');
  });

  it('shows the line on the partner page', async () => {
    stubAffiliate({ partner: { ...PARTNER, scopeMode: 'selected', scopeProductIds: ['odoo-product-6'] } });
    const { container } = renderPage('en');
    await waitFor(() => expect(container.querySelector('[data-purpose="partner-scope"]')?.textContent).toBe(`Your code applies to ${cardName({ id: 'odoo-product-6' }, 'en')} only.`));
  });
});

describe('an organization is requested from the store, not opened by the shopper', () => {
  it('offers the application form, in Chinese, to a shopper with no organization and no application', async () => {
    const calls = stubAffiliate({ organization: null, application: null });
    const { container } = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(container.querySelector('[data-purpose="application-form"]')).toBeTruthy());
    for (const chinese of ['如果你是大 V，可以提交联系方式和粉丝数据截图', '粉丝数据截图', '上传截图', '机构名称', '联系人', '邮箱', '电话或 WhatsApp', '网站或社交媒体主页', '机构介绍', '提交申请']) {
      expect(text(container)).toContain(chinese);
    }
    expect(text(container)).not.toMatch(/Organization name|Create organization|Commission rate|Submit/);
    // nothing is opened without the store
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('sends the contact details and then shows the application waiting for the store', async () => {
    const calls = stubAffiliate({ organization: null, application: null });
    const { container } = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(container.querySelector('[data-purpose="application-form"]')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('机构名称'), { target: { value: 'Travel Crew' } });
    fireEvent.change(screen.getByLabelText('联系人'), { target: { value: 'Sam Lee' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText('电话或 WhatsApp'), { target: { value: '+86 138 0000 0000' } });
    fireEvent.change(screen.getByLabelText('网站或社交媒体主页'), { target: { value: 'https://travelcrew.example' } });
    fireEvent.change(screen.getByLabelText('机构介绍'), { target: { value: 'We run a travel channel.' } });
    fireEvent.click(screen.getByRole('button', { name: '提交申请' }));

    await waitFor(() => expect(container.querySelector('[data-purpose="application-status"]')?.getAttribute('data-status')).toBe('pending'));
    const sent = calls.find((call) => call.method === 'POST');
    expect(sent?.url).toMatch(/\/api\/v1\/plugins\/affiliate\/store\/organizations\/applications$/);
    expect(sent?.body).toEqual({
      organizationName: 'Travel Crew', contactName: 'Sam Lee', email: 'sam@example.com', phone: '+86 138 0000 0000',
      website: 'https://travelcrew.example', message: 'We run a travel channel.',
    });
    // the old "create organization" call is never made
    expect(calls.some((call) => call.method === 'POST' && /\/organizations$/.test(call.url))).toBe(false);

    const page = text(container);
    // the card shows the application as the store received it
    for (const chinese of ['审核中', '申请审核中', '我们已收到「Travel Crew」的申请，会通过 sam@example.com 与你联系。', 'Travel Crew', 'Sam', '提交时间']) expect(page).toContain(chinese);
    expect(page).not.toMatch(/under review|Organization|Submit application/);
    expect(container.querySelector('[data-purpose="application-form"]')).toBeNull();
  });

  it('shows the store’s reason when it declined, and keeps the name for a new application', async () => {
    stubAffiliate({ organization: null, application: { ...APPLICATION, status: 'rejected', reviewNote: 'Not a fit yet', reviewedAt: '2026-11-27T03:00:00.000Z' } });
    const { container } = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(container.querySelector('[data-purpose="application-status"]')?.getAttribute('data-status')).toBe('rejected'));
    expect(text(container)).toContain('申请未通过');
    expect(text(container)).toContain('我们的回复：Not a fit yet');

    fireEvent.click(screen.getByRole('button', { name: '重新申请' }));
    await waitFor(() => expect(container.querySelector('[data-purpose="application-form"]')).toBeTruthy());
    expect((screen.getByLabelText('机构名称') as HTMLInputElement).value).toBe('Travel Crew');
    expect(container.querySelector('[data-purpose="application-status"]')).toBeNull();
  });

  it('shows the organization itself once the store opened it: members by name, no creation form', async () => {
    stubAffiliate();
    const { container } = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(container.querySelector('[data-purpose="affiliate-organization"]')).toBeTruthy());
    const page = text(container);
    for (const chinese of ['Travel Crew', '机构佣金比例 6%', '成员', '所有者', '创作者', '添加', '机构佣金']) expect(page).toContain(chinese);
    expect(screen.getByLabelText('成员邮箱')).toBeTruthy();
    expect(page).not.toMatch(/Create organization|OWNER|INFLUENCER|organization rate|Member email/);
    expect(container.querySelector('[data-purpose="application-form"]')).toBeNull();
    expect(container.querySelector('[data-purpose="application-status"]')).toBeNull();
  });

  it('says a refused application in the shopper’s language', async () => {
    stubAffiliate({
      organization: null, application: null,
      submit: { status: 409, body: { code: 'USER_ALREADY_ORGANIZED', message: 'This account already belongs to an organization' } },
    });
    const { container } = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(container.querySelector('[data-purpose="application-form"]')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('机构名称'), { target: { value: 'Travel Crew' } });
    fireEvent.change(screen.getByLabelText('联系人'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'sam@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '提交申请' }));
    await waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('该账户已属于一个机构。'));
  });

  it('takes the language from the page address when the storefront passes none', async () => {
    window.history.replaceState({}, '', '/ja/affiliate');
    stubAffiliate({ organization: null, application: null });
    const { container } = renderPage(undefined);
    await waitFor(() => expect(screen.getByRole('button', { name: '組織' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '組織' }));
    await waitFor(() => expect(container.querySelector('[data-purpose="application-form"]')).toBeTruthy());
    expect(text(container)).toContain('クリエイターネットワーク。');
    expect(text(container)).not.toMatch(/Creator network|Organization name/);
  });
});

describe('an application asks a creator for a followers screenshot (2026-11-27)', () => {
  const PNG = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'followers.png', { type: 'image/png' });
  const screenshotInput = (container: HTMLElement) => container.querySelector('[data-purpose="screenshot-input"]') as HTMLInputElement;
  /** The organization tab for a shopper with no organization; with `form: false` for one whose application waits. */
  const openTab = async (options: Options = {}, form = true) => {
    const calls = stubAffiliate({ organization: null, application: null, ...options });
    const page = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(page.container.querySelector(form ? '[data-purpose="application-form"]' : '[data-purpose="application-status"]')).toBeTruthy());
    return { ...page, calls, uploads: calls };
  };

  it('the form names the screenshot and says it is optional, in the shopper’s language', async () => {
    const { container } = await openTab();
    expect(screen.getByLabelText('粉丝数据截图')).toBeTruthy();
    expect(text(container)).toContain('选填。如果你是大 V');
    expect(screen.getByRole('button', { name: '上传截图' })).toBeTruthy();
    expect(text(container)).toContain('通过后可获得更高的佣金比例和二级返佣');
    expect(text(container)).not.toContain('留下信息，我们会尽快联系你');
  });

  it('the same form in English carries no Chinese', async () => {
    stubAffiliate({ organization: null, application: null });
    const { container } = renderPage('en');
    fireEvent.click(screen.getByRole('button', { name: 'Organization' }));
    await waitFor(() => expect(container.querySelector('[data-purpose="application-form"]')).toBeTruthy());
    expect(screen.getByLabelText('Followers screenshot')).toBeTruthy();
    expect(text(container)).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('choosing an image sends it at once, and the page says it was sent', async () => {
    localStorage.setItem('auth_token', 'token-of-the-shopper');
    const { container, uploads } = await openTab();
    fireEvent.change(screenshotInput(container), { target: { files: [PNG()] } });
    await waitFor(() => expect(container.querySelector('[data-purpose="screenshot-sent"]')?.textContent).toContain('截图已发送'));
    const sent = uploads.find((call) => call.method === 'POST' && call.url.endsWith('/organizations/applications/screenshot'));
    expect(sent?.file).toBeInstanceOf(File);
    expect((sent!.file as File).type).toBe('image/png');
    expect(sent!.authorization).toBe('Bearer token-of-the-shopper');
    expect(screen.getByRole('button', { name: '重新上传' })).toBeTruthy();
    expect(container.querySelector('[data-purpose="screenshot-error"]')).toBeNull();
  });

  it('what is not a JPEG, PNG, or WebP image, or is over 5 MB, is refused before it leaves the page', async () => {
    const { container, uploads } = await openTab();
    fireEvent.change(screenshotInput(container), { target: { files: [new File(['<html>'], 'x.png', { type: 'text/html' })] } });
    await waitFor(() => expect(container.querySelector('[data-purpose="screenshot-error"]')?.textContent).toContain('截图必须是 JPEG、PNG 或 WebP 图片'));
    fireEvent.change(screenshotInput(container), { target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })] } });
    await waitFor(() => expect(container.querySelector('[data-purpose="screenshot-error"]')?.textContent).toContain('截图不能超过 5 MB'));
    expect(uploads.filter((call) => call.url.endsWith('/organizations/applications/screenshot'))).toHaveLength(0);
    expect(container.querySelector('[data-purpose="screenshot-sent"]')).toBeNull();
  });

  it('when the store refuses a screenshot, the shopper is told in their language', async () => {
    const { container } = await openTab({ upload: { status: 400, body: { code: 'INVALID_FILE_TYPE', message: 'Screenshots must be JPEG, PNG, or WebP images' } } });
    fireEvent.change(screenshotInput(container), { target: { files: [PNG()] } });
    await waitFor(() => expect(container.querySelector('[data-purpose="screenshot-error"]')?.textContent).toContain('截图必须是 JPEG、PNG 或 WebP 图片'));
    expect(container.querySelector('[data-purpose="screenshot-sent"]')).toBeNull();
  });

  it('when the store cannot take a screenshot at all, the shopper is told to try again', async () => {
    const { container } = await openTab({ upload: { status: 503, body: { code: 'STORAGE_UNAVAILABLE', message: 'Screenshot storage is not configured' } } });
    fireEvent.change(screenshotInput(container), { target: { files: [PNG()] } });
    await waitFor(() => expect(container.querySelector('[data-purpose="screenshot-error"]')?.textContent).toContain('截图发送失败'));
    expect(container.querySelector('[data-purpose="screenshot-sent"]')).toBeNull();
  });

  it('the waiting card shows the screenshot the account sent', async () => {
    const { container } = await openTab({ application: APPLICATION, screenshot: undefined }, false);
    await waitFor(() => expect(container.querySelector('[data-purpose="application-screenshot"]')).toBeTruthy());
  });

  it('the waiting card has no screenshot when the account sent none', async () => {
    const { container } = await openTab({ application: APPLICATION, screenshot: null }, false);
    // what the card shows has settled once the application is on the page and the page has asked for the screenshot
    await waitFor(() => expect(container.querySelector('[data-purpose="application-status"][data-status="pending"]')).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('[data-purpose="application-screenshot"]')).toBeNull();
  });
});

describe('who sees the members of an organization', () => {
  it('the owner sees them and can add one', async () => {
    stubAffiliate();
    const { container } = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(container.querySelector('[data-purpose="affiliate-organization"]')).toBeTruthy());
    expect(text(container)).toContain('kim@example.com');
    expect((screen.getByLabelText('成员邮箱') as HTMLInputElement).closest('form')!.style.display).not.toBe('none');
    expect((container.querySelector('[data-purpose="member-of"]') as HTMLElement).style.display).toBe('none');
  });

  it('a member sees the 机构 and their own place in it, and none of the other members', async () => {
    stubAffiliate({ organization: { ...ORGANIZATION, members: [], canManageMembers: false, viewerRole: 'INFLUENCER' } });
    const { container } = renderPage('zh-Hans');
    await openOrganizationTab();
    await waitFor(() => expect(container.querySelector('[data-purpose="affiliate-organization"]')).toBeTruthy());
    expect(text(container)).not.toContain('kim@example.com');
    expect(text(container)).not.toContain('sam@example.com');
    expect((screen.getByLabelText('成员邮箱') as HTMLInputElement).closest('form')!.style.display).toBe('none');
    const place = container.querySelector('[data-purpose="member-of"]') as HTMLElement;
    expect(place.style.display).not.toBe('none');
    expect(place.textContent).toContain(AFFILIATE.memberOf.hans);
    expect(place.textContent).toContain('创作者');
    expect(text(container)).toContain('Travel Crew');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a guest is asked to sign in', () => {
  it('the page says so in the shopper’s language, and shows no error', async () => {
    stubAffiliate({ guest: true });
    const { container } = renderPage('zh-Hans');
    await waitFor(() => expect(text(container)).toContain('登录后即可查看你的推广链接和收益。'));
    expect(screen.getByRole('button', { name: /登入|登录/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('[data-purpose="partner-scope"]')).toBeNull();
    expect(affiliateErrorText('en', { code: 'SIGN_IN_REQUIRED', message: 'Sign in to use the affiliate workspace' })).toBe('Sign in to see your referral link and earnings.');
    expect(affiliateErrorText('fr', { code: 'FILE_TOO_LARGE', message: 'x' })).toBe('La capture ne doit pas dépasser 5 Mo.');
    expect(affiliateErrorText('de', { code: 'INVALID_FILE_TYPE', message: 'x' })).toBe('Screenshots müssen JPEG-, PNG- oder WebP-Bilder sein.');
  });
});

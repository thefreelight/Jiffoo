// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeEditor } from '@/components/themes/ThemeEditor';
import { ThemeSettingField } from '@/components/themes/ThemeSettingsForm';
import ThemesPage from '@/app/[locale]/(themed)/themes/page';
import StorefrontCodePage from '@/app/[locale]/(themed)/storefront-code/page';
import { AdminApiError } from '@/lib/api';
import { StoreTimeProvider } from '@/lib/store-time';
import type { ThemeConfig, ThemeRecord } from '@/lib/themes';
import type { CodeConfiguration } from '@/lib/storefront-code';

const mocks = vi.hoisted(() => ({ list: vi.fn(), config: vi.fn(), saveTheme: vi.fn(), restoreConfig: vi.fn(), current: vi.fn(), saveCode: vi.fn(), history: vi.fn(), revision: vi.fn(), restoreCode: vi.fn(), switchCode: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), useSearchParams: () => new URLSearchParams() }));
vi.mock('shared/src/i18n/react', () => { const translate = (key: string) => key; return { useLocale: () => 'zh-Hans', useT: () => translate }; });
vi.mock('@/lib/api', async importOriginal => { const original = await importOriginal<typeof import('@/lib/api')>(); return { ...original, staffApi: { getByUserId: vi.fn().mockResolvedValue({ success: true, data: { username: 'Owner' } }) } }; });
vi.mock('@/lib/themes', () => ({ themesApi: { list: mocks.list, config: mocks.config, save: mocks.saveTheme, restoreConfig: mocks.restoreConfig } }));
vi.mock('@/lib/storefront-code', () => ({ storefrontCodeApi: { current: mocks.current, save: mocks.saveCode, history: mocks.history, revision: mocks.revision, restore: mocks.restoreCode, switch: mocks.switchCode } }));

const theme: ThemeRecord = { slug: 'sample', target: 'shop', name: 'Sample', version: '1.0.0', source: 'uploaded', trustLevel: 'unsigned', packageHash: 'a'.repeat(64), activatedAt: '2026-10-15T00:00:00Z', packageState: { status: 'available', code: null }, manifestJson: { description: 'Theme description', assets: {}, settings: [] } };
const config: ThemeConfig = { revision: 2, configurationSavedAt: '2026-10-15T00:15:00Z', values: {}, settings: [{ id: 'accent', type: 'color', label: { en: 'Accent', 'zh-Hans': '强调色', 'zh-Hant': '強調色' }, default: '#123456', constraints: {} }], homeSections: [] };
const code: CodeConfiguration = { enabled: true, revision: 2, updatedAt: '2026-10-15T00:15:00Z', updatedById: 'owner', ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null, headCode: '', bodyStartCode: '', bodyEndCode: '' };
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  mocks.list.mockResolvedValue([theme]); mocks.config.mockResolvedValue(config); mocks.current.mockResolvedValue(code);
  mocks.history.mockResolvedValue({ items: [{ ...code, id: 'old', revision: 1, createdAt: code.updatedAt, createdById: 'owner', restoredFromRevision: null }], total: 1, page: 1, totalPages: 1, limit: 10 });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === text)!;
async function render(node: React.ReactNode) { await act(async () => root.render(<StoreTimeProvider timezone="Asia/Shanghai" now="2026-10-15T00:00:00Z">{node}</StoreTimeProvider>)); }
async function enter(selector: string, value: string) { await act(async () => { const field = document.querySelector<HTMLInputElement>(selector)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); }); }

it('shows a saved timestamp only when configuration has actually been saved, in the store zone', async () => {
  await render(<ThemeEditor target="shop" slug="sample" />);
  expect(container.textContent).toContain('已保存 · 2026-10-15 08:15'); expect(container.textContent).toContain('Asia/Shanghai');
  await act(async () => root.unmount()); root = createRoot(container);
  mocks.config.mockResolvedValue({ ...config, configurationSavedAt: null, revision: 0 });
  await render(<ThemeEditor target="shop" slug="sample" />);
  expect(container.textContent).not.toContain('已保存 ·'); expect(container.textContent).not.toContain('2026-10-15');
});

it('preserves a dirty theme draft on conflict and loads the latest only on request', async () => {
  mocks.saveTheme.mockRejectedValue(new AdminApiError('Conflict', 'THEME_CONFIG_CONFLICT'));
  await render(<ThemeEditor target="shop" slug="sample" />); await enter('input[aria-label="强调色 色值"]', '#abcdef');
  expect(container.textContent).toContain('有未保存的更改'); await act(async () => button('保存').click());
  expect(mocks.saveTheme).toHaveBeenCalledWith('sample', { accent: '#abcdef' }, 2, undefined);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('别人刚刚');
  expect(container.querySelector<HTMLInputElement>('input[aria-label="强调色 色值"]')?.value).toBe('#abcdef');
  expect(mocks.config).toHaveBeenCalledTimes(1);
  mocks.config.mockResolvedValue({ ...config, revision: 3, values: { accent: '#654321' } });
  await act(async () => button('载入最新配置').click());
  expect(container.querySelector<HTMLInputElement>('input[aria-label="强调色 色值"]')?.value).toBe('#654321');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('resets home sections only after confirmation and submits null with the current revision', async () => {
  await render(<ThemeEditor target="shop" slug="sample" />);
  await act(async () => { document.querySelector<HTMLButtonElement>('button[aria-label="更多操作"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); });
  await act(async () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent === '重置首页为主题默认')!.click());
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  await act(async () => button('确认').click());
  mocks.saveTheme.mockResolvedValue({ ...config, revision: 3 });
  await act(async () => button('保存').click());
  expect(mocks.saveTheme).toHaveBeenCalledWith('sample', { accent: '#123456' }, 2, null);
});

it('keeps rejected theme input and focuses the field identified by the server', async () => {
  mocks.saveTheme.mockRejectedValue(new AdminApiError('Invalid setting', 'THEME_CONFIG_INVALID', { path: '/values/accent' }));
  await render(<ThemeEditor target="shop" slug="sample" />);
  const field = container.querySelector<HTMLInputElement>('#theme-accent')!;
  field.scrollIntoView = vi.fn();
  await enter('input[aria-label="' + field.nextElementSibling!.getAttribute('aria-label') + '"]', '#abcdef');
  await act(async () => button('保存').click());
  expect(document.activeElement).toBe(field);
  expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  expect((field.nextElementSibling as HTMLInputElement).value).toBe('#abcdef');
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it('disables activation for real corrupt packages and counts only the selected target', async () => {
  mocks.list.mockResolvedValue([theme, { ...theme, slug: 'broken', name: 'Broken', activatedAt: null, packageState: { status: 'corrupt', code: 'THEME_PACKAGE_CORRUPT' } }, { ...theme, slug: 'other-target', target: 'admin', activatedAt: null, packageState: { status: 'corrupt', code: 'THEME_PACKAGE_CORRUPT' } }]);
  await render(<ThemesPage />); expect(button('启用').disabled).toBe(true);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('有 1 个主题包已损坏');
});

it('blocks invalid Meta Pixel input inline without saving and restores an older revision through the API', async () => {
  mocks.revision.mockResolvedValue({ ...code, revision: 1, headCode: 'prior code', id: 'old', createdAt: code.updatedAt, createdById: 'owner', restoredFromRevision: null });
  await render(<StorefrontCodePage />); await enter('#metaPixelId', '18273x45');
  expect(container.querySelector('#metaPixelId-hint')?.textContent).toBe('格式不对：只能是 1–32 位数字。'); expect(button('保存').disabled).toBe(true); expect(mocks.saveCode).not.toHaveBeenCalled();
  await enter('#metaPixelId', '1827345'); expect(button('保存').disabled).toBe(false);
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="查看并恢复 #1"]')!.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('prior code');
  mocks.restoreCode.mockResolvedValue({ ...code, revision: 3, headCode: 'prior code' });
  await act(async () => button('merchant.storefrontCode.restore').click());
  expect(mocks.restoreCode).toHaveBeenCalledWith(1, 2);
  expect(container.querySelector<HTMLTextAreaElement>('#headCode')?.value).toBe('prior code');
});

it('updates the master switch immediately while saving and confirms the persisted state', async () => {
  let finish!: (value: CodeConfiguration) => void;
  mocks.switchCode.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await render(<StorefrontCodePage />);
  const control = () => container.querySelector<HTMLButtonElement>('[role="switch"]')!;
  await act(async () => control().click());
  expect(control().getAttribute('aria-checked')).toBe('false');
  expect(control().disabled).toBe(true);
  expect(mocks.switchCode).toHaveBeenCalledWith(false);
  await act(async () => finish({ ...code, enabled: false, revision: 3 }));
  expect(control().getAttribute('aria-checked')).toBe('false');
  expect(control().disabled).toBe(false);
});

it('rolls back the master switch if the server refuses the change', async () => {
  mocks.switchCode.mockRejectedValueOnce(new AdminApiError('Unavailable', 'INTERNAL_SERVER_ERROR'));
  await render(<StorefrontCodePage />);
  await act(async () => container.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it('does not claim the theme list is empty when the list request failed', async () => {
  mocks.list.mockRejectedValueOnce(new Error('Network unavailable'));
  await render(<ThemesPage />);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.textContent).not.toContain('尚未安装主题');
});

it('previews only Core image paths and never requests an external theme image', async () => {
  const setting = { id: 'image', type: 'image' as const, label: { en: 'Image', 'zh-Hans': '图片', 'zh-Hant': '圖片' }, default: 'assets/image.png', constraints: {} };
  await render(<ThemeSettingField setting={setting} locale="zh-Hans" value="https://outside.example/image.png" imageSrc="https://outside.example/image.png" onChange={vi.fn()} />);
  expect(container.querySelector('img')).toBeNull();
  const source = `/api/v1/themes/sample/${'a'.repeat(64)}/assets/image.png`;
  await render(<ThemeSettingField setting={setting} locale="zh-Hans" value="assets/image.png" imageSrc={source} onChange={vi.fn()} />);
  expect(container.querySelector('img')?.getAttribute('src')).toBe(source);
});

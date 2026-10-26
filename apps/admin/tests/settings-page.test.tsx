// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/[locale]/(themed)/settings/page';
import { requestAppNavigation } from '@/lib/pending-navigation';
const mock = vi.hoisted(() => ({ getAll: vi.fn(), batchUpdate: vi.fn(), get: vi.fn(), post: vi.fn(), delete: vi.fn(), push: vi.fn() }));
vi.mock('shared/src/i18n/react', async () => { const { translate } = await import('./helpers/operations'); return { useLocale: () => 'en', useT: () => translate }; });
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/lib/api', () => ({ settingsApi: mock, apiClient: mock, unwrapApiResponse: <T,>(response: { data: T }) => response.data, uploadApi: { uploadProductImage: vi.fn() } }));
const key = 'checkout.address.countries_require_state_postal';
const catalogKey = 'fulfillment.policy_catalog';
const catalog = [
  { name: 'physical', productType: 'physical', policy: { requiresShippingAddress: true, requiresShippingQuote: true, tracksInventory: true } },
  { name: 'digital', productType: 'digital', policy: { requiresShippingAddress: false, requiresShippingQuote: false, tracksInventory: false } },
];
const initial = { 'branding.platform_name': 'Test shop', 'localization.currency': 'USD', 'localization.locale': 'en', 'localization.timezone': 'UTC', [key]: ['US'], [catalogKey]: catalog };
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.clearAllMocks(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; Element.prototype.scrollIntoView = vi.fn(); mock.getAll.mockResolvedValue({ data: initial }); mock.batchUpdate.mockImplementation(async updates => ({ data: { ...initial, ...updates } })); mock.get.mockResolvedValue({ data: [] }); mock.post.mockResolvedValue({ data: { token: 'jft_real' } }); mock.delete.mockResolvedValue({ data: {} }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(<SettingsPage />)); }
function button(name: string) { const result = [...document.querySelectorAll('button')].find(value => value.textContent === name || value.getAttribute('aria-label') === name); expect(result).toBeDefined(); return result!; }
async function click(name: string) { await act(async () => button(name).click()); }
async function fill(id: string, value: string) { const input = document.getElementById(id) as HTMLInputElement; expect(input).not.toBeNull(); await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function save() { await act(async () => document.getElementById('settings-editor')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
// The first test of this file pays the one-time cost of mounting the whole settings page in
// jsdom: React's first mount of every settings section plus the Intl region-name table the
// page builds. That cost is CPU bound, so it grows with the rest of the admin suite running
// in parallel and reached ~2.8s under full-suite load, which together with the three save
// cycles below exceeded the 5s default budget. The budget below covers that first mount plus
// the three save rounds; the assertions are unchanged.
it('validates the order prefix, tracks dirty state and saves it only on success', async () => {
  await render();
  expect((document.getElementById('orders.number_prefix') as HTMLInputElement).value).toBe('JF');
  expect(container.textContent).toContain('Applies to new orders only');
  await fill('orders.number_prefix', 'jf'); await save();
  expect(mock.batchUpdate).not.toHaveBeenCalled();
  expect(document.activeElement?.id).toBe('orders.number_prefix');
  await fill('orders.number_prefix', 'SHOP');
  expect(container.textContent).toContain('Unsaved changes');
  mock.batchUpdate.mockRejectedValueOnce(new Error()); await save();
  expect(document.activeElement?.id).toBe('orders.number_prefix');
  expect((document.getElementById('orders.number_prefix') as HTMLInputElement).value).toBe('SHOP');
  await save();
  expect(mock.batchUpdate).toHaveBeenLastCalledWith({ 'orders.number_prefix': 'SHOP' });
  expect(button('Save').disabled).toBe(true);
}, 30_000);
it('shows every section, a disabled clean save and no fabricated saved timestamp', async () => { await render(); expect(button('Save').disabled).toBe(true); for (const title of ['Shop information', 'Contact details', 'Language, currency and timezone', 'Checkout', 'Fulfillment policies', 'API tokens']) expect(container.textContent).toContain(title); expect(container.textContent).not.toContain('2026-10-12 18:00'); });
it('renders the fulfillment policies the API publishes and saves the selection of a product type', async () => {
  await render();
  const digital = container.querySelector<HTMLButtonElement>('#fulfillment-digital')!;
  expect(digital.getAttribute('aria-checked')).toBe('false');
  expect(container.textContent).toContain('digital');
  await act(async () => digital.click());
  expect(container.textContent).toContain('Unsaved changes');
  await save();
  expect(mock.batchUpdate).toHaveBeenCalledWith({ 'fulfillment.policies': { digital: 'digital' } });
  expect(container.querySelector<HTMLButtonElement>('#fulfillment-digital')!.getAttribute('aria-checked')).toBe('true');
  expect(button('Save').disabled).toBe(true);
}, 30_000);
it('takes the product types of the fulfillment section from the API', async () => {
  mock.getAll.mockResolvedValue({ data: { ...initial, [catalogKey]: [{ name: 'virtual', productType: 'virtual', policy: { requiresShippingAddress: false, requiresShippingQuote: false, tracksInventory: false } }] } });
  await render();
  expect(container.textContent).toContain('virtual');
  expect(container.querySelector('#fulfillment-physical')).toBeNull();
  expect(container.querySelector('#fulfillment-virtual')).not.toBeNull();
}, 30_000);
it('keeps the fulfillment selection when the server refuses the save', async () => {
  mock.batchUpdate.mockRejectedValue(new Error());
  await render();
  await act(async () => container.querySelector<HTMLButtonElement>('#fulfillment-digital')!.click());
  await save();
  expect(container.textContent).toContain('Your changes are still here.');
  expect(container.querySelector<HTMLButtonElement>('#fulfillment-digital')!.getAttribute('aria-checked')).toBe('true');
}, 30_000);
it('removes the last country and saves an explicit empty list', async () => { await render(); await click('Remove United States'); expect(container.textContent).toContain('No country requires state/province and postal code.'); await save(); expect(mock.batchUpdate).toHaveBeenCalledWith({ [key]: [] }); expect(button('Save').disabled).toBe(true); });
it('uses defaults only when the countries setting is absent', async () => { const { [key]: _, ...unset } = initial; mock.getAll.mockResolvedValue({ data: unset }); await render(); expect(container.textContent).toContain('United Kingdom'); expect(container.textContent).toContain('Canada'); });
it('tracks edits, discards all changes and guards unload only while dirty', async () => { await render(); await fill('branding.platform_name', 'Changed'); expect(container.textContent).toContain('Unsaved changes'); const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); await click('Discard changes'); expect((document.getElementById('branding.platform_name') as HTMLInputElement).value).toBe('Test shop'); const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false); });
it('keeps inputs, reports validation and focuses the first error before a successful save', async () => { await render(); await fill('branding.platform_name', ''); await fill('contact.email', 'bad'); await save(); expect(mock.batchUpdate).not.toHaveBeenCalled(); expect(document.activeElement?.id).toBe('branding.platform_name'); expect(container.textContent).toContain('Enter a shop name.'); await fill('branding.platform_name', 'New shop'); await fill('contact.email', 'help@example.com'); await save(); expect(mock.batchUpdate).toHaveBeenCalledWith({ 'branding.platform_name': 'New shop', 'contact.email': 'help@example.com' }); expect(button('Save').disabled).toBe(true); });
it('preserves edits and focuses the changed input after a server save failure', async () => { mock.batchUpdate.mockRejectedValue(new Error()); await render(); await fill('branding.platform_name', 'Keep this'); await save(); expect(container.textContent).toContain('Your changes are still here.'); expect((document.getElementById('branding.platform_name') as HTMLInputElement).value).toBe('Keep this'); expect(document.activeElement?.id).toBe('branding.platform_name'); });
it.each(['Keep editing', 'Leave without saving', 'Save and leave'])('handles the %s navigation decision', async decision => { await render(); await fill('branding.platform_name', 'Changed'); const navigate = vi.fn(); await act(async () => requestAppNavigation(navigate)); expect(navigate).not.toHaveBeenCalled(); await click(decision); expect(navigate).toHaveBeenCalledTimes(decision === 'Keep editing' ? 0 : 1); expect(mock.batchUpdate).toHaveBeenCalledTimes(decision === 'Save and leave' ? 1 : 0); });
it('does not navigate when save-and-leave fails', async () => { mock.batchUpdate.mockRejectedValue(new Error()); await render(); await fill('branding.platform_name', 'Changed'); const navigate = vi.fn(); await act(async () => requestAppNavigation(navigate)); await click('Save and leave'); expect(navigate).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Keep editing'); });
it('retries an initial load failure', async () => { mock.getAll.mockRejectedValueOnce(new Error()); await render(); expect(container.textContent).toContain('Unable to load settings'); await click('Retry'); expect(container.textContent).toContain('Test shop'); });
it('creates a scoped token and shows the one-time value', async () => { await render(); await click('Create token'); const dialog = document.querySelector('[role="dialog"]')!; const input = dialog.querySelector('input')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My app'); input.dispatchEvent(new Event('input', { bubbles: true })); }); await act(async () => dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); expect(mock.post).toHaveBeenCalledWith('/admin/api-tokens', { label: 'My app', scopes: ['catalog:read'] }); expect((document.querySelector('input[readonly]') as HTMLInputElement).value).toBe('jft_real'); });
it('requires a token name and preserves its form after a server rejection', async () => { await render(); await click('Create token'); const dialog = document.querySelector('[role="dialog"]')!; const submit = async () => { await act(async () => dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }; await submit(); expect(document.body.textContent).toContain('Enter a name and select at least one permission.'); expect(mock.post).not.toHaveBeenCalled(); const input = dialog.querySelector('input')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Retained app'); input.dispatchEvent(new Event('input', { bubbles: true })); }); mock.post.mockRejectedValueOnce(new Error()); await submit(); expect(input.value).toBe('Retained app'); expect(dialog.textContent).toContain('Unable to complete token action'); });
it('shows real token permissions and phone cards, and requires confirmation before revoking', async () => { mock.get.mockResolvedValue({ data: [{ id: 'token-one', label: 'My app', scopes: ['catalog:read'], createdAt: '2026-10-13T00:00:00Z', lastUsedAt: null }] }); await render(); expect(container.textContent).toContain('Read products'); expect(container.textContent).toContain('Never used'); expect(container.querySelector('article')!.getAttribute('aria-label')).toBe('My app'); await click('Revoke token: My app'); expect(mock.delete).not.toHaveBeenCalled(); mock.delete.mockRejectedValueOnce(new Error()); const confirm = () => [...document.querySelectorAll('[role="alertdialog"] button')].find(button => button.textContent === 'Revoke') as HTMLButtonElement; await act(async () => confirm().click()); expect(document.body.textContent).toContain('Unable to complete token action'); mock.get.mockResolvedValue({ data: [] }); await act(async () => confirm().click()); expect(mock.delete).toHaveBeenCalledWith('/admin/api-tokens/token-one'); expect(container.textContent).toContain('No API tokens yet'); });
it('warns about unchanged prices when currency changes and discards the warning', async () => { await render(); const select = document.getElementById('localization.currency')!; await act(async () => { select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }); const option = [...document.querySelectorAll('[role=option]')].find(option => option.textContent?.includes('CNY'))!; expect(option).toBeDefined(); await act(async () => { (option as HTMLElement).click(); }); expect(container.textContent).toContain('Changing currency does not convert existing product prices'); await click('Discard changes'); expect(container.textContent).not.toContain('Changing currency does not convert existing product prices'); });

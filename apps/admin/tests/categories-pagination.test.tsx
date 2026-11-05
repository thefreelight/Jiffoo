// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import CategoriesPage from '../app/[locale]/(themed)/products/categories/page';
const state = vi.hoisted(() => ({ replace: vi.fn(), query: vi.fn(), url: 'search=books&source=products' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }), usePathname: () => '/en/products/categories', useSearchParams: () => new URLSearchParams(state.url) }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, values?: Record<string, string | number>) => key + (values ? ' ' + Object.values(values).join(' ') : '') }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('../components/products/ContentTranslations', () => ({ useStoreDefaultLocale: () => ({ data: 'en' }), ContentTranslations: () => null }));
vi.mock('../lib/hooks/use-api', () => ({ useCategories: (page: number, limit: number, search: string) => { state.query(page, limit, search); return { data: { items: [], total: 200 }, isLoading: false }; } }));
it('pages the remote category query and resets to page one when the page size changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => { state.replace(data, unused, url); state.url = String(url).split('?')[1] ?? ''; });
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const button = (label: string) => { const value = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(item => item.getAttribute('aria-label') === label); expect(value).toBeDefined(); return value!; };
  try {
    await act(async () => root.render(<CategoriesPage />));
    expect(state.query).toHaveBeenLastCalledWith(1, 20, 'books');
    await act(async () => button('merchant.orders.list.next').click());
    expect(state.query).toHaveBeenLastCalledWith(2, 20, 'books');
    expect(state.replace.mock.lastCall?.[2]).toContain('page=2');
    const size = container.querySelector<HTMLSelectElement>('select[aria-label="merchant.orders.list.perPage"]')!;
    await act(async () => { size.value = '50'; size.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(state.query).toHaveBeenLastCalledWith(1, 50, 'books');
    const url = state.replace.mock.lastCall?.[2]; expect(url).toContain('pageSize=50'); expect(url).toContain('search=books'); expect(url).toContain('source=products'); expect(url).not.toContain('page=2');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); }
});

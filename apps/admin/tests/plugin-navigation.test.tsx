// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { usePluginNavigation } from '../lib/use-plugin-navigation';
const transport = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../lib/api', () => ({ apiClient: transport, unwrapApiResponse: (value: { data: unknown }) => value.data }));
let root: Root | undefined;
let latest: ReturnType<typeof usePluginNavigation> = [];
function Probe({ identity, path }: { identity?: string; path: string }) {
  const pages = usePluginNavigation(identity, path);
  useEffect(() => { latest = pages; }, [pages]);
  return null;
}
async function render(identity?: string, path = '/en/plugins') {
  if (!root) {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    root = createRoot(document.createElement('div'));
  }
  await act(async () => root!.render(<Probe identity={identity} path={path} />));
}
const pages = (slug: string) => [{ slug, pages: [{ id: 'main', path: '/main', title: { en: 'Main', 'zh-Hans': 'Main', 'zh-Hant': 'Main' } }] }];
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; latest = []; transport.get.mockReset(); vi.unstubAllGlobals(); });
it('hides empty declarations and clears entries after a failed refresh', async () => {
  transport.get.mockResolvedValueOnce({ data: [{ slug: 'empty', pages: [] }] }).mockResolvedValueOnce({ data: pages('sample') }).mockRejectedValueOnce(new Error('Forbidden'));
  await render('one'); expect(latest).toEqual([]);
  await render('one', '/en/dashboard'); expect(latest).toEqual(pages('sample'));
  await act(async () => window.dispatchEvent(new Event('focus'))); expect(latest).toEqual([]);
});
it('does not let an older focus request overwrite the newest declaration', async () => {
  let older!: (value: unknown) => void;
  let newer!: (value: unknown) => void;
  transport.get.mockResolvedValueOnce({ data: [] }).mockImplementationOnce(() => new Promise(resolve => { older = resolve; })).mockImplementationOnce(() => new Promise(resolve => { newer = resolve; }));
  await render('one');
  await act(async () => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')); });
  await act(async () => newer({ data: pages('new') }));
  await act(async () => older({ data: pages('old') }));
  expect(latest).toEqual(pages('new'));
});
it('discards requests from the prior identity and clears cached entries on logout', async () => {
  let previous!: (value: unknown) => void;
  transport.get.mockImplementationOnce(() => new Promise(resolve => { previous = resolve; })).mockResolvedValueOnce({ data: pages('second') });
  await render('one'); await render('two');
  await act(async () => previous({ data: pages('first') })); expect(latest).toEqual(pages('second'));
  await render(undefined); expect(latest).toEqual([]);
  transport.get.mockImplementationOnce(() => new Promise(() => undefined));
  await render('two'); expect(latest).toEqual([]);
});
it('refreshes declarations when browser navigation changes the pathname', async () => {
  transport.get.mockResolvedValue({ data: [] });
  await render('one', '/en/dashboard'); await render('one', '/en/plugins/sample'); await render('one', '/en/dashboard');
  expect(transport.get).toHaveBeenCalledTimes(3);
  expect(transport.get).toHaveBeenCalledWith('/admin/plugin-pages');
});

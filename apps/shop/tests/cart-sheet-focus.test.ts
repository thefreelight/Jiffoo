// @vitest-environment jsdom
import { act, createElement as h, type ComponentProps, type MouseEvent as ReactMouseEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartButton, CartSheet } from '../components/cart-sheet';
import { useCartUI } from '../lib/cart-ui';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), setError: vi.fn(), capture: vi.fn(), change: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ onClick, children, ...props }: ComponentProps<'a'>) => h('a', { ...props, onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onClick?.(event); } }, children) }));
vi.mock('../lib/use-cart', () => ({ useCart: () => ({ cart: { items: [], itemCount: 0, subtotal: 0 }, busy: false, error: '', setError: mocks.setError, availability: { blocked: false, message: '', capture: mocks.capture, clear: vi.fn() }, refresh: mocks.refresh, change: mocks.change, blocked: false }) }));

let root: Root, container: HTMLDivElement;
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const render = async (showTrigger = true) => {
  await act(async () => root.render(h('div', null,
    showTrigger && h(CartButton, { initialCount: 0, locale: 'en', loggedIn: true }),
    h('button', { type: 'button' }, 'Add product'),
    h(CartSheet, { locale: 'en', currency: 'USD', loggedIn: true }),
  ))); await settle();
};
const button = (name: string) => {
  const found = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(target => (target.getAttribute('aria-label') ?? target.textContent) === name);
  expect(found, name).toBeDefined(); return found!;
};
const click = async (target: HTMLElement) => { await act(async () => { target.focus(); target.click(); }); await settle(); };
const escape = async () => { await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); }); await settle(); };
const cartButton = () => {
  const found = container.querySelector<HTMLButtonElement>('button[aria-label]'); expect(found).not.toBeNull(); return found!;
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  useCartUI.setState({ open: false, count: null, lastAdded: null });
  mocks.refresh.mockResolvedValue(undefined);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); await settle(); container.remove(); useCartUI.setState({ open: false, count: null, lastAdded: null }); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('Cart sheet focus with the real Radix sheet', () => {
  it.each(['Escape', 'Close'])('restores the persistent cart button after %s', async method => {
    await render(); const trigger = cartButton(); await click(trigger);
    const modal = document.body.querySelector('[role="dialog"]')!; expect(modal.contains(document.activeElement)).toBe(true);
    if (method === 'Escape') await escape(); else await click(button('Close'));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
    await click(trigger); expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });
  it('keeps forward and reverse Tab inside the sheet', async () => {
    await render(); await click(cartButton()); const modal = document.body.querySelector('[role="dialog"]')!;
    const controls = Array.from(modal.querySelectorAll<HTMLElement>('a[href],button')).filter(control => !control.hasAttribute('disabled'));
    const first = controls[0], last = controls.at(-1)!;
    await act(async () => { last.focus(); last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); }); expect(document.activeElement).toBe(first);
    await act(async () => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); }); expect(document.activeElement).toBe(last);
  });
  it('returns focus to the opener after dismissing through the real overlay', async () => {
    await render(); const trigger = cartButton(); await click(trigger);
    const overlay = document.body.querySelector<HTMLElement>('[data-slot="sheet-overlay"]'); expect(overlay).not.toBeNull();
    await act(async () => { overlay!.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, cancelable: true })); }); await settle();
    expect(useCartUI.getState().open).toBe(false); expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it('returns automatic added-item opening to the focused product action', async () => {
    await render(); const trigger = button('Add product');
    await act(async () => { trigger.focus(); useCartUI.getState().added('Book', 1); }); await settle();
    expect(document.body.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    await escape(); expect(document.activeElement).toBe(trigger);
  });
  it.each(['/en/cart', '/en/checkout'])('skips return focus when navigating to %s', async href => {
    await render(); const trigger = cartButton(); await click(trigger); const returnFocus = vi.spyOn(trigger, 'focus');
    const destination = document.body.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!; await click(destination);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(useCartUI.getState().open).toBe(false); expect(returnFocus).not.toHaveBeenCalled();
  });
  it('closes safely after the opening control unmounts', async () => {
    await render(); const trigger = cartButton(); await click(trigger); const returnFocus = vi.spyOn(trigger, 'focus');
    await render(false); expect(trigger.isConnected).toBe(false); await escape();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(returnFocus).not.toHaveBeenCalled();
  });
});

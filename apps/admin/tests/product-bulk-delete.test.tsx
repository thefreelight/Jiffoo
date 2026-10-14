// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { BulkDeleteDialog } from '../components/products/BulkDeleteDialog';
import type { ProductBulkResult } from '../lib/api';
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((object, part) => object?.[part], merchant);
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
it.each([false, true])('shows real delete and skip counts; all-skipped=%s has no destructive action', async allSkipped => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const node = document.createElement('div'); document.body.append(node); const root = createRoot(node), confirm = vi.fn(), cancel = vi.fn();
  const result: ProductBulkResult = { matched: 3, processed: allSkipped ? 0 : 2, skippedCount: allSkipped ? 3 : 1,
    skipped: [{ id: 'sold', name: 'Sold shirt', reason: 'HAS_ORDERS' }], processedPreview: allSkipped ? [] : [{ id: 'a', name: 'Canvas bag' }, { id: 'b', name: 'Gift card' }] };
  try {
    await act(async () => root.render(<BulkDeleteDialog result={result} pending={false} error="" onCancel={cancel} onConfirm={confirm} />));
    const dialog = document.querySelector('[role="alertdialog"]')!;
    expect(dialog.textContent).toContain('Delete 3 products?');
    const button = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent === 'Delete 2 products');
    if (allSkipped) { expect(button).toBeUndefined(); expect(dialog.textContent).toContain(merchant.catalog.deleteAllSkipped); }
    else { expect(dialog.textContent).toContain('Canvas bag'); expect(dialog.textContent).toContain('Gift card'); expect(dialog.textContent).toContain('Sold shirt'); await act(async () => button!.click()); expect(confirm).toHaveBeenCalledOnce(); }
  } finally { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); }
});
it('explains missing products without claiming that they have orders', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const node = document.createElement('div'); document.body.append(node); const root = createRoot(node);
  const result: ProductBulkResult = { matched: 1, processed: 0, skippedCount: 1,
    skipped: [{ id: 'removed-product', name: '', reason: 'NOT_FOUND' }], processedPreview: [] };
  try {
    await act(async () => root.render(<BulkDeleteDialog result={result} pending={false} error="" onCancel={vi.fn()} onConfirm={vi.fn()} />));
    const dialog = document.querySelector('[role="alertdialog"]')!;
    expect(dialog.textContent).toContain('removed-product no longer exist and will be skipped.');
    expect(dialog.textContent).not.toContain('have orders');
    expect(Array.from(dialog.querySelectorAll('button')).some(button => /^Delete/.test(button.textContent ?? ''))).toBe(false);
  } finally { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); }
});

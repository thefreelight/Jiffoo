// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeSettingsForm } from '@/components/themes/ThemeSettingsForm';
import { HomeSectionsEditor, addHomeSection, moveHomeSection, sectionFieldLabel } from '@/components/themes/HomeSectionsEditor';
import { SECTION_TYPES, merchantSectionSchemas } from '../../../packages/shared/src/extensions/theme-contract';
import { themeError, themeErrorKeys } from '@/lib/theme-messages';
import type { HomeSection, ThemeConfig, ThemeSetting } from '@/lib/themes';

vi.mock('@/lib/api', () => ({
  productsApi: { getAll: vi.fn(), getCategories: vi.fn() },
  uploadApi: { uploadProductImage: vi.fn() },
  unwrapApiResponse: (value: unknown) => value,
}));

const label = { en: 'Field', 'zh-Hans': '字段', 'zh-Hant': '欄位' };
const setting = (id: string, type: ThemeSetting['type'], value: unknown, constraints: ThemeSetting['constraints'] = {}):
  ThemeSetting => ({ id, type, label: { ...label, en: id }, default: value, constraints });
const config: ThemeConfig = {
  revision: 4, values: {},
  settings: [
    setting('color', 'color', '#123456'),
    setting('text', 'text', { en: 'Hello', 'zh-Hans': '你好', 'zh-Hant': '你好' }, { maxLength: 60 }),
    setting('image', 'image', 'assets/photo.png'),
    setting('category', 'category', 'category-id'),
    setting('products', 'product-list', [], { maxItems: 2 }),
    setting('boolean', 'boolean', false),
    setting('select', 'select', 'small', { options: ['small', 'large'] }),
    setting('number', 'number', 2, { min: 1, max: 5, step: 1 }),
    setting('link', 'link', '/products'),
  ],
};

describe('Admin theme settings and validation', () => {
  it('B5 maps upload storage outages and corruption in all three locales', () => {
    for (const [code, key] of [['UPLOAD_STORAGE_UNAVAILABLE', 'uploadUnavailable'], ['UPLOAD_STORAGE_CORRUPT', 'uploadCorrupt']] as const) {
      expect(themeErrorKeys[code]).toBe(key);
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(themeError(locale, code)).not.toBe(themeError(locale, 'UNKNOWN_ERROR'));
        expect(themeError(locale, code)).not.toContain(code);
      }
    }
  });
  it('B4 maps storage and lease failures distinctly in all three locales', () => {
    const cases = { THEME_PACKAGE_UNAVAILABLE: 'unavailable', THEME_PACKAGE_MATERIALIZATION_TIMEOUT: 'unavailable', THEME_PACKAGE_CORRUPT: 'corrupt', THEME_OPERATION_IN_PROGRESS: 'busy', THEME_OPERATION_LEASE_LOST: 'leaseLost' } as const;
    for (const [code, key] of Object.entries(cases)) {
      expect(themeErrorKeys[code as keyof typeof themeErrorKeys]).toBe(key);
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        const text = themeError(locale, code);
        expect(text).not.toBe(themeError(locale, 'UNKNOWN_ERROR'));
        expect(text).not.toContain(code);
      }
    }
  });
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  it('A renders all nine setting types and submits exact values with expectedRevision', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<ThemeSettingsForm config={config} locale="en" assets={['assets/photo.png']}
      onSave={save} onRestore={vi.fn()} />));
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(1);
    expect(container.querySelectorAll('select')).toHaveLength(3);
    expect(container.querySelectorAll('input[required]')).toHaveLength(6);
    await act(async () => {
      const field = container.querySelector<HTMLInputElement>('#theme-color')!;
      field.value = '#abcdef';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(save).toHaveBeenCalledWith({
      expectedRevision: 4,
      values: { color: '#123456', text: { en: 'Hello', 'zh-Hans': '你好', 'zh-Hant': '你好' },
        image: 'assets/photo.png', category: 'category-id', products: [], boolean: false,
        select: 'small', number: 2, link: '/products' },
    });
  });

  it('B maps every stable theme validation code to human-readable messages in all locales', () => {
    for (const code of Object.keys(themeErrorKeys)) {
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        const rendered = themeError(locale, code, { path: '/layout/pages/home/sections/0' });
        expect(rendered, `${locale}: ${code}`).toContain('/layout/pages/home/sections/0');
        expect(rendered).not.toContain(code);
        expect(rendered.length).toBeGreaterThan(30);
      }
    }
    expect(themeError('en', 'THEME_FORBIDDEN_ENTRY', { path: 'assets/run.js' })).toContain('assets/run.js');
  });

  it('G seeds resolved home sections and submits add edit move delete with the exact revision', async () => {
    const original: HomeSection[] = [
      { id: 'categories', type: 'category-list', settings: { title: { ...label } } },
      { id: 'products', type: 'product-grid', settings: { title: { ...label }, source: 'latest' } },
    ];
    const added = addHomeSection(original, 'text-block');
    const edited = added.map((section) => section.id === 'section-1'
      ? { ...section, settings: { body: { en: 'Welcome', 'zh-Hans': '欢迎', 'zh-Hant': '歡迎' } } }
      : section);
    const moved = moveHomeSection(edited, 2, -1);
    const final = moved.filter((section) => section.id !== 'categories');
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<ThemeSettingsForm
      config={{ settings: [], values: {}, revision: 7, homeSections: final }}
      locale="en" assets={[]} onSave={save} onRestore={vi.fn()} />));
    expect(container.querySelector<HTMLInputElement>('input[value="Welcome"]')?.value).toBe('Welcome');
    await act(async () => {
      const down = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Move down' && !button.disabled)!;
      down.click();
    });
    await act(async () => {
      const up = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Move up' && !button.disabled)!;
      up.click();
    });
    await act(async () => container.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })));
    expect(save).toHaveBeenCalledWith({ expectedRevision: 7, values: {}, homeSections: final });
    expect(final.map((section) => section.id)).toEqual(['section-1', 'products']);
  });

  it('H generates an edit form for every section type in the shared catalog', async () => {
    for (const type of SECTION_TYPES) {
      const sections = addHomeSection([], type);
      await act(async () => root.render(<HomeSectionsEditor sections={sections}
        locale="en" onChange={vi.fn()} onReset={vi.fn()} />));
      const schema = merchantSectionSchemas[type] as { properties: {
        settings: { properties: Record<string, unknown> };
      } };
      for (const name of Object.keys(schema.properties.settings.properties))
        expect(container.textContent, `${type}.${name}`).toContain(sectionFieldLabel(name, 'en'));
    }
  });
});

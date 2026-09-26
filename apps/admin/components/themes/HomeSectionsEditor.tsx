'use client';

import { merchantSectionSchemas, SECTION_TYPES } from '../../../../packages/shared/src/extensions/theme-contract';
import { themeMessage } from '@/lib/theme-messages';
import type { HomeSection, Locale } from '@/lib/themes';

type Schema = {
  type?: string; properties?: Record<string, Schema>; required?: string[];
  items?: Schema; enum?: string[]; minimum?: number; maximum?: number; maxItems?: number;
};
const names = SECTION_TYPES as readonly string[];
const sectionNames: Record<string, [string, string, string]> = {
  'announcement-bar': ['Announcement bar', '公告栏', '公告欄'],
  'hero-banner': ['Hero banner', '主视觉横幅', '主視覺橫幅'],
  'image-carousel': ['Image carousel', '图片轮播', '圖片輪播'],
  'category-list': ['Category list', '分类列表', '分類列表'],
  'product-grid': ['Product grid', '商品网格', '商品網格'],
  'image-with-text': ['Image with text', '图文区块', '圖文區塊'],
  'text-block': ['Text block', '文字区块', '文字區塊'],
  'feature-list': ['Feature list', '特色列表', '特色列表'],
};
const localeIndex = (locale: Locale) => ['en', 'zh-Hans', 'zh-Hant'].indexOf(locale);
const fieldNames: Record<string, [string, string, string]> = {
  text: ['Text', '文字', '文字'], title: ['Title', '标题', '標題'],
  body: ['Body', '正文', '內文'], image: ['Image', '图片', '圖片'],
  alt: ['Image description', '图片描述', '圖片描述'],
  link: ['Link', '链接', '連結'], buttonLabel: ['Button label', '按钮文字', '按鈕文字'],
  slides: ['Slides', '轮播图片', '輪播圖片'],
  categoryIds: ['Categories', '分类', '分類'], categoryId: ['Category', '分类', '分類'],
  productIds: ['Products', '商品', '商品'], count: ['Count', '数量', '數量'],
  columns: ['Columns', '列数', '欄數'], source: ['Product source', '商品来源', '商品來源'],
  position: ['Image position', '图片位置', '圖片位置'],
  items: ['Items', '项目', '項目'], icon: ['Icon', '图标', '圖示'],
  latest: ['Latest', '最新', '最新'], category: ['Category', '分类', '分類'],
  manual: ['Manual', '手动选择', '手動選擇'],
  left: ['Left', '左侧', '左側'], right: ['Right', '右侧', '右側'],
  check: ['Check', '勾选', '勾選'], star: ['Star', '星形', '星形'],
  truck: ['Truck', '配送车', '配送車'],
};
export const sectionFieldLabel = (key: string, locale: Locale) =>
  fieldNames[key]?.[localeIndex(locale)] ?? key;

function initial(schema: Schema): unknown {
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'object') return Object.fromEntries(
    (schema.required ?? []).map((key) => [key, initial(schema.properties![key])]));
  if (schema.type === 'array') return schema.items && schema.maxItems !== 0
    ? [initial(schema.items)] : [];
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
  if (schema.type === 'boolean') return false;
  return '';
}

export function addHomeSection(sections: HomeSection[], type: string): HomeSection[] {
  const schema = merchantSectionSchemas[type] as Schema;
  if (!schema || sections.length >= 30) return sections;
  const ids = new Set(sections.map((section) => section.id));
  let number = 1;
  while (ids.has(`section-${number}`)) number++;
  return [...sections, { id: `section-${number}`, type,
    settings: initial(schema.properties!.settings) as Record<string, unknown> }];
}

export function moveHomeSection(sections: HomeSection[], index: number, delta: number): HomeSection[] {
  const destination = index + delta;
  if (index < 0 || destination < 0 || destination >= sections.length) return sections;
  const result = [...sections];
  [result[index], result[destination]] = [result[destination], result[index]];
  return result;
}

function ValueField({ label, schema, value, change, locale }: {
  label: string; schema: Schema; value: unknown; change: (value: unknown) => void; locale: Locale;
}) {
  if (schema.type === 'object') {
    const record = (value ?? {}) as Record<string, unknown>;
    return <fieldset className="space-y-2 border-l pl-3"><legend className="font-medium">{label}</legend>
      {Object.entries(schema.properties ?? {}).map(([key, child]) =>
        key in record
          ? <div key={key}><ValueField label={sectionFieldLabel(key, locale)}
              schema={child} value={record[key]} locale={locale}
              change={(next) => change({ ...record, [key]: next })} />
            {!schema.required?.includes(key) && <button type="button"
              onClick={() => { const copy = { ...record }; delete copy[key]; change(copy); }}>
              {themeMessage(locale, 'removeField')} {sectionFieldLabel(key, locale)}</button>}</div>
          : <button key={key} type="button" onClick={() => change({ ...record, [key]: initial(child) })}>
            {themeMessage(locale, 'addField')} {sectionFieldLabel(key, locale)}</button>)}
    </fieldset>;
  }
  if (schema.type === 'array') {
    const items = Array.isArray(value) ? value : [];
    return <fieldset className="space-y-2 border-l pl-3"><legend>{label}</legend>
      {items.map((item, index) => <div key={index} className="border-b pb-2">
        <ValueField label={`${label} ${index + 1}`} schema={schema.items!} value={item} locale={locale}
          change={(next) => change(items.map((current, position) => position === index ? next : current))} />
        <button type="button" onClick={() => change(items.filter((_, position) => position !== index))}>
          {themeMessage(locale, 'removeField')} {label} {index + 1}</button>
      </div>)}
      <button type="button" disabled={items.length >= (schema.maxItems ?? 30)}
        onClick={() => change([...items, initial(schema.items!)])}>
        {themeMessage(locale, 'addField')} {label}</button>
    </fieldset>;
  }
  if (schema.enum) return <label className="block text-sm">{label}
    <select className="block w-full rounded border p-2" value={String(value)}
      onChange={(event) => change(event.target.value)}>
      {schema.enum.map((option) => <option key={option} value={option}>
        {sectionFieldLabel(option, locale)}</option>)}
    </select></label>;
  if (schema.type === 'boolean') return <label className="flex gap-2">
    <input type="checkbox" checked={value === true} onChange={(event) => change(event.target.checked)} />
    {label}</label>;
  return <label className="block text-sm">{label}
    <input className="block w-full rounded border p-2" required
      type={schema.type === 'integer' || schema.type === 'number' ? 'number' : 'text'}
      min={schema.minimum} max={schema.maximum} value={String(value ?? '')}
      onChange={(event) => change(schema.type === 'integer' || schema.type === 'number'
        ? Number(event.target.value) : event.target.value)} />
  </label>;
}

export function HomeSectionsEditor({ sections, locale, onChange, onReset }: {
  sections: HomeSection[]; locale: Locale; onChange: (sections: HomeSection[]) => void;
  onReset: () => void;
}) {
  const update = (index: number, settings: Record<string, unknown>) =>
    onChange(sections.map((section, position) => position === index ? { ...section, settings } : section));
  return <section aria-label={themeMessage(locale, 'homePage')} className="space-y-4 border-t pt-4">
    <h3 className="font-semibold">{themeMessage(locale, 'homePage')}</h3>
    <label className="block">{themeMessage(locale, 'addSection')}
      <select className="ml-2 rounded border p-2" value="" disabled={sections.length >= 30}
        onChange={(event) => { onChange(addHomeSection(sections, event.target.value)); event.target.value = ''; }}>
        <option value="">{themeMessage(locale, 'choose')}</option>
        {names.map((type) => <option key={type} value={type}>{sectionNames[type][localeIndex(locale)]}</option>)}
      </select></label>
    {sections.map((section, index) => {
      const schema = merchantSectionSchemas[section.type] as Schema;
      return <article key={section.id} className="space-y-3 border-b pb-4">
        <h4 className="font-medium">{sectionNames[section.type][localeIndex(locale)]} · {section.id}</h4>
        <div className="flex gap-3">
          <button type="button" disabled={index === 0}
            onClick={() => onChange(moveHomeSection(sections, index, -1))}>{themeMessage(locale, 'moveUp')}</button>
          <button type="button" disabled={index === sections.length - 1}
            onClick={() => onChange(moveHomeSection(sections, index, 1))}>{themeMessage(locale, 'moveDown')}</button>
          <button type="button" onClick={() => onChange(sections.filter((_, position) => position !== index))}>
            {themeMessage(locale, 'deleteSection')}</button>
        </div>
        <ValueField label={themeMessage(locale, 'editSection')} schema={schema.properties!.settings} locale={locale}
          value={section.settings} change={(value) => update(index, value as Record<string, unknown>)} />
      </article>;
    })}
    <button type="button" onClick={onReset}>{themeMessage(locale, 'resetHome')}</button>
  </section>;
}

'use client';

import { useId, useState } from 'react';
import { sectionNames, sectionDescriptions, fieldNames } from 'shared/src/i18n/messages/admin-theme-sections';
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

import { merchantSectionSchemas, SECTION_TYPES } from '../../../../packages/shared/src/extensions/theme-contract';
import { themeMessage } from 'shared/src/i18n/messages/admin-themes';
import type { HomeSection, Locale } from '@/lib/themes';

type Schema = {
  type?: string; properties?: Record<string, Schema>; required?: string[];
  items?: Schema; enum?: string[]; minimum?: number; maximum?: number; maxItems?: number;
};
const names = SECTION_TYPES as readonly string[];
const localeIndex = (locale: Locale) => ['en', 'zh-Hans', 'zh-Hant'].indexOf(locale);
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
  const fieldId = useId();
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
          : <button key={key} type="button" className="mr-2 inline-flex min-h-8 items-center rounded-md border border-border bg-ground px-2.5" onClick={() => change({ ...record, [key]: initial(child) })}>
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
  if (schema.enum?.includes('latest')) return <fieldset className="space-y-1.5"><legend>{label}</legend><div className="flex flex-wrap gap-4">{schema.enum.map(option => <label key={option} className="inline-flex items-center gap-1.5"><input type="radio" className="accent-foreground" name={fieldId} value={option} checked={value === option} onChange={() => change(option)} />{sectionFieldLabel(option, locale)}</label>)}</div></fieldset>;
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
    <input className="block h-[34px] w-full rounded-md border border-border bg-ground px-2.5" required
      type={schema.type === 'integer' || schema.type === 'number' ? 'number' : 'text'}
      min={schema.minimum} max={schema.maximum} value={String(value ?? '')}
      onChange={(event) => change(schema.type === 'integer' || schema.type === 'number'
        ? Number(event.target.value) : event.target.value)} />
  </label>;
}

function ProductGridFields({ settings, schema, locale, change }: {
  settings: Record<string, unknown>; schema: Schema; locale: Locale;
  change: (settings: Record<string, unknown>) => void;
}) {
  const field = (key: string, value = settings[key]) => <ValueField
    label={sectionFieldLabel(key, locale)} schema={schema.properties![key]} value={value} locale={locale}
    change={next => change({ ...settings, [key]: next })} />;
  return <div className="space-y-3.5">
    {field('title')}
    {field('source')}
    {settings.source === 'category' && field('categoryId', settings.categoryId ?? '')}
    {settings.source === 'manual' && field('productIds', settings.productIds ?? [])}
    <div className="grid max-w-[400px] grid-cols-2 gap-3">
      {field('count', settings.count ?? 12)}
      {field('columns', settings.columns ?? 4)}
    </div>
  </div>;
}

export function HomeSectionsEditor({ sections, locale, onChange }: {
  sections: HomeSection[]; locale: Locale; onChange: (sections: HomeSection[]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(() => sections.find(section => section.type === 'product-grid')?.id ?? null);
  const update = (index: number, settings: Record<string, unknown>) =>
    onChange(sections.map((section, position) => position === index ? { ...section, settings } : section));
  return <section aria-label={themeMessage(locale, 'homePage')} className="rounded-lg border border-border">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div><h2 className="font-semibold">{themeMessage(locale, 'homePage')}</h2><p className="text-xs text-faint">{themeMessage(locale, 'homeNote')}</p></div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-[30px] gap-1.5 bg-ground" disabled={sections.length >= 30}><Plus size={13} />{themeMessage(locale, 'addSection')}</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{names.map(type => <DropdownMenuItem key={type} aria-label={sectionNames[type][localeIndex(locale)]} onSelect={() => { const next = addHomeSection(sections, type); onChange(next); setExpanded(next[next.length - 1].id); }}><span className="flex flex-col"><span>{sectionNames[type][localeIndex(locale)]}</span><span className="text-xs text-faint">{sectionDescriptions[type][localeIndex(locale)]}</span></span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
    </div><ol>
    {sections.map((section, index) => {
      const schema = merchantSectionSchemas[section.type] as Schema;
      const name = sectionNames[section.type][localeIndex(locale)], open = expanded === section.id;
      return <li key={section.id} className={`border-b border-border last:border-b-0 ${open ? 'bg-raised' : ''}`}><div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 sm:pl-4"><span className="w-[18px] font-mono text-[11px] text-faint">{index + 1}</span><div className="min-w-0 flex-1"><h3 className="break-words font-medium">{name}</h3><p className="truncate text-xs text-muted-foreground">{String(((section.settings.title ?? section.settings.text ?? section.settings.body) as Record<string, unknown> | undefined)?.[locale] ?? '')}</p></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`${themeMessage(locale, 'moveUp')}: ${name}`} disabled={index === 0} onClick={() => onChange(moveHomeSection(sections, index, -1))}><ArrowUp size={13} /></Button><Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`${themeMessage(locale, 'moveDown')}: ${name}`} disabled={index === sections.length - 1} onClick={() => onChange(moveHomeSection(sections, index, 1))}><ArrowDown size={13} /></Button><Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" aria-expanded={open} onClick={() => setExpanded(open ? null : section.id)}>{themeMessage(locale, open ? 'collapse' : 'edit')}</Button><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={`${themeMessage(locale, 'deleteSection')}: ${name}`} onClick={() => onChange(sections.filter((_, position) => position !== index))}><Trash2 size={14} /></Button></div></div>
        {open && <div className="space-y-3.5 px-4 pb-4 sm:pl-11">{section.type === 'product-grid'
          ? <ProductGridFields settings={section.settings} schema={schema.properties!.settings} locale={locale} change={value => update(index, value)} />
          : <ValueField label={themeMessage(locale, 'editSection')} schema={schema.properties!.settings} locale={locale} value={section.settings} change={value => update(index, value as Record<string, unknown>)} />}</div>}
      </li>;
    })}
    </ol>
  </section>;
}

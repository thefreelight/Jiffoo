'use client';

import { useState } from 'react';
import { productsApi, uploadApi, unwrapApiResponse } from '@/lib/api';
import { themeMessage } from '@/lib/theme-messages';
import type { Locale, ThemeConfig, ThemeSetting } from '@/lib/themes';

export function buildThemePayload(config: ThemeConfig, draft: Record<string, unknown>) {
  return { values: draft, expectedRevision: config.revision };
}

function Field({ setting, locale, value, onChange }: {
  setting: ThemeSetting; locale: Locale; value: unknown; onChange: (value: unknown) => void;
}) {
  const label = setting.label[locale];
  const id = `theme-${setting.id}`;
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [query, setQuery] = useState('');
  if (setting.type === 'text') {
    const translated = value as Record<Locale, string>;
    return <fieldset className="space-y-2"><legend className="font-medium">{label}</legend>
      {(['en', 'zh-Hans', 'zh-Hant'] as const).map((language) =>
        <label key={language} className="block text-sm">{language}
          <input className="mt-1 block w-full rounded border p-2" required maxLength={setting.constraints.maxLength}
            value={translated[language] ?? ''} onChange={(event) => onChange({ ...translated, [language]: event.target.value })} />
        </label>)}
    </fieldset>;
  }
  if (setting.type === 'boolean') return <label className="flex items-center gap-2"><input type="checkbox"
    checked={value === true} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
  if (setting.type === 'color') return <div><label htmlFor={id}>{label}</label><div className="flex gap-2">
    <input id={id} aria-label={`${label} color`} type="color" value={String(value).slice(0, 7)}
      onChange={(event) => onChange(event.target.value)} />
    <input aria-label={`${label} hex`} className="rounded border p-2" required pattern="^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"
      value={String(value)} onChange={(event) => onChange(event.target.value)} /></div></div>;
  if (setting.type === 'image') return <div><label htmlFor={id}>{label}</label>
    <input id={id} className="block w-full rounded border p-2" readOnly value={String(value)} />
    <label className="block text-sm">{themeMessage(locale, 'image')}
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) onChange(unwrapApiResponse(await uploadApi.uploadProductImage(file)).url);
      }} />
    </label></div>;
  if (setting.type === 'category') return <div><label htmlFor={id}>{label}</label>
    <select id={id} className="block w-full rounded border p-2" value={String(value)}
      onFocus={async () => {
        const result = unwrapApiResponse(await productsApi.getCategories(1, 100));
        setCategories(result.items.map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })));
      }} onChange={(event) => onChange(event.target.value)}>
      {!categories.some((item) => item.id === value) && <option value={String(value)}>{String(value)}</option>}
      {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></div>;
  if (setting.type === 'product-list') {
    const selected = Array.isArray(value) ? value as string[] : [];
    return <fieldset><legend>{label}</legend><label>{themeMessage(locale, 'search')}
      <input className="block w-full rounded border p-2" value={query} onChange={async (event) => {
        setQuery(event.target.value);
        if (event.target.value.trim()) {
          const result = unwrapApiResponse(await productsApi.getAll(1, 20, event.target.value));
          setProducts(result.items.map((item) => ({ id: item.id, name: item.name })));
        } else setProducts([]);
      }} /></label>
      {selected.map((productId) => <label key={productId} className="block">
        <input type="checkbox" checked onChange={() => onChange(selected.filter((id) => id !== productId))} /> {productId}
      </label>)}
      {products.filter((item) => !selected.includes(item.id)).map((item) =>
        <label key={item.id} className="block"><input type="checkbox"
          disabled={selected.length >= (setting.constraints.maxItems ?? 20)}
          onChange={() => onChange([...selected, item.id])} /> {item.name}</label>)}
    </fieldset>;
  }
  if (setting.type === 'select') return <div><label htmlFor={id}>{label}</label>
    <select id={id} className="block w-full rounded border p-2" value={String(value)}
      onChange={(event) => onChange(event.target.value)}>
      {setting.constraints.options?.map((option) => <option key={option} value={option}>{option}</option>)}
    </select></div>;
  return <div><label htmlFor={id}>{label}</label>
    <input id={id} className="block w-full rounded border p-2" required
      type={setting.type === 'number' ? 'number' : 'text'}
      min={setting.constraints.min} max={setting.constraints.max} step={setting.constraints.step}
      value={String(value)} onChange={(event) =>
        onChange(setting.type === 'number' ? Number(event.target.value) : event.target.value)} /></div>;
}

export function ThemeSettingsForm({ config, locale, assets, onSave, onRestore }: {
  config: ThemeConfig; locale: Locale; assets: string[];
  onSave: (payload: ReturnType<typeof buildThemePayload>) => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(config.settings.map((item) => [item.id, config.values[item.id] ?? item.default])));
  const [busy, setBusy] = useState(false);
  return <form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    try { await onSave(buildThemePayload(config, draft)); } finally { setBusy(false); }
  }}>
    {config.settings.map((setting) => setting.type === 'image'
      ? <div key={setting.id}><Field setting={setting} locale={locale} value={draft[setting.id]}
        onChange={(value) => setDraft((current) => ({ ...current, [setting.id]: value }))} />
        <label>{themeMessage(locale, 'asset')}
          <select className="block w-full rounded border p-2" value=""
            onChange={(event) => setDraft((current) => ({ ...current, [setting.id]: event.target.value }))}>
            <option value="">{themeMessage(locale, 'choose')}</option>
            {assets.map((asset) => <option key={asset} value={asset}>{asset}</option>)}
          </select>
        </label></div>
      : <Field key={setting.id} setting={setting} locale={locale} value={draft[setting.id]}
        onChange={(value) => setDraft((current) => ({ ...current, [setting.id]: value }))} />)}
    <div className="flex gap-3"><button disabled={busy} type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
      {themeMessage(locale, 'save')}</button>
      <button disabled={busy} type="button" className="rounded border px-4 py-2" onClick={() => void onRestore()}>
        {themeMessage(locale, 'restoreConfig')}</button></div>
  </form>;
}

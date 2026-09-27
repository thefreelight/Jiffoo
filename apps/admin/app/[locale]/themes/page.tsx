'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'shared/src/i18n/react';
import { AdminApiError } from '@/lib/api';
import { themeError, themeMessage } from '@/lib/theme-messages';
import { themesApi, type Locale, type ThemeConfig, type ThemeRecord, type ThemeTarget } from '@/lib/themes';
import { ThemeSettingsForm } from '@/components/themes/ThemeSettingsForm';

export default function ThemesPage() {
  const locale = useLocale() as Locale;
  const [target, setTarget] = useState<ThemeTarget>('shop');
  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [active, setActive] = useState<Record<ThemeTarget, string>>({ shop: '', admin: '' });
  const [selected, setSelected] = useState<ThemeRecord | null>(null);
  const [config, setConfig] = useState<ThemeConfig | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirmUnsigned, setConfirmUnsigned] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    try {
      const [list, shop, admin] = await Promise.all([
        themesApi.list(), themesApi.active('shop', locale), themesApi.active('admin', locale),
      ]);
      setThemes(list);
      setActive({ shop: shop.slug, admin: admin.slug });
      setError('');
    } catch (cause) {
      setError(message(cause));
    } finally { setLoading(false); }
  }, [locale]);
  const message = (cause: unknown) => cause instanceof AdminApiError
    ? themeError(locale, cause.code, cause.details) : themeMessage(locale, 'failed');
  useEffect(() => { void reload(); }, [reload]);
  const action = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try { await work(); await reload(); setError(''); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  };
  const configure = async (theme: ThemeRecord) => {
    await action(async () => {
      setConfig(await themesApi.config(theme.slug));
      setSelected(theme);
      setNotice('');
    });
  };
  return <main className="min-h-screen bg-neutral-veil px-4 py-6 text-neutral-deepest sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <h1 className="text-xl font-semibold">{themeMessage(locale, 'themes')}</h1>
        <button className="rounded border bg-surface px-3 py-2 text-sm" disabled={busy}
          onClick={() => void action(() => themesApi.restore(target))}>{themeMessage(locale, 'restore')}</button>
      </header>
      <div role="tablist" aria-label={themeMessage(locale, 'themes')} className="flex gap-1 border-b">
        {(['shop', 'admin'] as const).map((value) => <button key={value} role="tab"
          aria-selected={target === value} className={`px-4 py-2 ${target === value ? 'border-b-2 border-action-strong font-semibold' : ''}`}
          onClick={() => { setTarget(value); setSelected(null); setConfig(null); }}>
          {themeMessage(locale, value)}</button>)}
      </div>
      {error && <p role="alert" className="border-l-4 border-danger-strong bg-danger-veil p-3 text-sm text-danger-dark">{error}</p>}
      {notice && <p role="status" className="border-l-4 border-success-strong bg-success-veil p-3 text-sm">{notice}</p>}
      <form aria-label={themeMessage(locale, 'upload')} className="flex flex-wrap items-end gap-4 border-b pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (file) void action(async () => {
            await themesApi.install(file, confirmUnsigned);
            setFile(null);
          });
        }}>
        <label className="text-sm">{themeMessage(locale, 'package')}
          <input className="block" type="file" accept=".zip" required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" required
          checked={confirmUnsigned} onChange={(event) => setConfirmUnsigned(event.target.checked)} />
          {themeMessage(locale, 'confirm')}</label>
        <button type="submit" disabled={busy || !file} className="rounded bg-action-strong px-4 py-2 text-surface">
          {themeMessage(locale, 'upload')}</button>
      </form>
      {loading ? <p>{themeMessage(locale, 'loading')}</p> : <div role="tabpanel" className="space-y-2">
        {themes.filter((theme) => theme.target === target).length === 0 && <p>{themeMessage(locale, 'empty')}</p>}
        {themes.filter((theme) => theme.target === target).map((theme) => {
          const isActive = active[target] === theme.slug;
          return <article key={theme.slug} className="flex flex-wrap items-center gap-3 border-b bg-surface px-4 py-4">
            <div className="min-w-40 flex-1"><h2 className="font-semibold">{theme.name}</h2>
              <p className="text-sm text-neutral-strong">{theme.version} · {themeMessage(locale, theme.source === 'builtin' ? 'sourceBuiltin' : 'sourceUploaded')} · {theme.trustLevel}</p></div>
            {isActive && <span className="rounded bg-success-faint px-2 py-1 text-sm text-success-deepest">{themeMessage(locale, 'active')}</span>}
            {!isActive && <button disabled={busy} className="rounded border px-3 py-2 text-sm"
              onClick={() => void action(() => themesApi.activate(target, theme.slug))}>{themeMessage(locale, 'activate')}</button>}
            <button disabled={busy} className="rounded border px-3 py-2 text-sm"
              onClick={() => void configure(theme)}>{themeMessage(locale, 'configure')}</button>
            {!isActive && theme.source !== 'builtin' && <button disabled={busy} className="rounded border px-3 py-2 text-sm text-danger-deep"
              onClick={() => void action(() => themesApi.uninstall(theme.slug))}>{themeMessage(locale, 'uninstall')}</button>}
          </article>;
        })}
      </div>}
      {selected && config && <section aria-label={`${themeMessage(locale, 'configure')} ${selected.name}`}
        className="max-w-2xl space-y-4 border-t pt-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{selected.name}</h2>
          <button onClick={() => { setSelected(null); setConfig(null); }}>{themeMessage(locale, 'close')}</button></div>
        <ThemeSettingsForm key={`${selected.slug}-${config.revision}`} config={config} locale={locale}
          assets={Object.values(selected.manifestJson.assets)}
          onSave={async (payload) => {
            setBusy(true);
            try {
              setConfig(await themesApi.save(selected.slug, payload.values, payload.expectedRevision,
                payload.homeSections));
              setError('');
              setNotice(themeMessage(locale, 'saved'));
            } catch (cause) {
              setError(message(cause));
              if (cause instanceof AdminApiError && cause.code === 'THEME_CONFIG_CONFLICT')
                setConfig(await themesApi.config(selected.slug));
            } finally { setBusy(false); }
          }}
          onRestore={async () => action(async () => {
            await themesApi.restoreConfig(selected.slug);
            setConfig(await themesApi.config(selected.slug));
            setNotice(themeMessage(locale, 'restored'));
          })} />
      </section>}
    </div>
  </main>;
}

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useLocale } from 'shared/src/i18n/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AuthLanguage, AuthAlert, authInputClass, authButtonClass, useAuthCopy } from '@/components/auth/auth-screen';
import { selectInstallState, type InstallSummary } from '@/lib/install-state';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch((process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/$/, '') + '/install/' + path, {
    credentials: 'include', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error('Installation request failed');
  // The install endpoints answer with the success envelope; the caller reads
  // the typed data of the envelope.
  return (result as { data: T }).data;
}

export default function InstallPage() {
  const text = useAuthCopy(), locale = useLocale();
  const [loading, setLoading] = useState(true), [installed, setInstalled] = useState(false), [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<InstallSummary | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [fields, setFields] = useState({ siteName: '', adminUsername: '', adminEmail: '', adminPassword: '', confirm: '' });
  const state = selectInstallState({ loading, installed, connected, summary });
  const locked = state !== 'form' || busy;
  async function check() {
    setLoading(true); setError('');
    try {
      const status = await request<{ isInstalled: boolean }>('status');
      setInstalled(status.isInstalled);
      if (!status.isInstalled) setConnected((await request<{ connected: boolean }>('check-database')).connected);
    } catch { setConnected(false); }
    finally { setLoading(false); }
  }
  useEffect(() => { void check(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMismatch(false);
    if (fields.adminPassword !== fields.confirm) { setMismatch(true); return; }
    setBusy(true);
    try {
      const { confirm: _confirm, ...data } = fields;
      setSummary(await request<InstallSummary>('complete', { ...data, siteName: data.siteName.trim(), adminEmail: data.adminEmail.trim().toLowerCase() }));
    } catch { setError(text('failed')); }
    finally { setBusy(false); }
  }
  const step = state === 'complete' || state === 'already' ? 3 : state === 'form' ? 2 : 1;
  const field = (key: keyof typeof fields, label: string, type = 'text', hint?: string) => <div className="min-w-0 space-y-1.5">
    <Label htmlFor={key} className="text-[13px] font-normal">{text(label)}</Label>
    <Input id={key} name={key} type={type} disabled={locked} required value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })}
      minLength={type === 'password' ? 8 : key === 'adminUsername' ? 2 : undefined} maxLength={key === 'adminUsername' ? 64 : undefined}
      pattern={key === 'adminUsername' ? '[A-Za-z0-9._\\-]{2,64}' : key === 'siteName' ? '.*\\S.*' : undefined}
      autoComplete={type === 'password' ? 'new-password' : key === 'adminEmail' ? 'email' : key === 'adminUsername' ? 'username' : 'organization'}
      aria-describedby={hint ? key + '-hint' : key === 'confirm' && mismatch ? 'confirm-error' : undefined} aria-invalid={key === 'confirm' && mismatch} className={authInputClass + ' disabled:bg-raised disabled:opacity-100'} />
    {hint && <p id={key + '-hint'} className="text-xs leading-[1.6] text-faint">{text(hint)}</p>}
  </div>;
  const login = <Link href={'/' + locale + '/auth/login'} className="flex h-[38px] items-center justify-center rounded-[7px] bg-foreground font-medium text-ground focus-visible:outline-2 focus-visible:outline-offset-2">{text('goLogin')}</Link>;
  return <main id="main" className="admin-auth-page flex min-h-dvh flex-col items-center gap-6 px-4 pt-12 pb-16 text-[13px] text-foreground">
    <header className="flex w-full max-w-[520px] items-center justify-between gap-3"><div className="flex items-center gap-[9px] text-[15px] font-semibold"><span aria-hidden="true" className="flex size-[26px] items-center justify-center rounded-[7px] bg-foreground text-[13px] text-ground">J</span>Jiffoo</div><AuthLanguage /></header>
    <div className="w-full max-w-[520px] space-y-1.5"><h1 className="text-2xl font-semibold tracking-[-0.02em]">{text(state === 'complete' ? 'installed' : state === 'already' ? 'alreadyInstalled' : 'install')}</h1><p className="leading-[1.6] text-muted-foreground">{text(state === 'complete' ? 'installedDescription' : state === 'already' ? 'alreadyDescription' : 'installDescription')}</p></div>
    <ol aria-label={text('steps')} className="grid w-full max-w-[520px] grid-cols-3 gap-2">{['checkStep', 'ownerStep', 'doneStep'].map((name, i) => <li key={name} aria-current={step === i + 1 ? 'step' : undefined} className={'flex flex-col gap-1.5 border-t-2 pt-2.5 ' + (i < step ? 'border-foreground' : 'border-border text-faint')}><span className="font-mono text-[11px] text-faint">{'0' + (i + 1)}</span><span className={step === i + 1 ? 'font-medium' : ''}>{text(name)}</span></li>)}</ol>
    <div className="admin-auth-panel flex w-full max-w-[520px] flex-col gap-[18px] rounded-xl border border-border p-6">
      <section aria-label={text('database')} className={'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ' + (state === 'failed' ? 'border-destructive-line bg-destructive-soft' : 'border-border bg-raised')}>
        <span aria-hidden="true" className={'mt-[5px] size-2 shrink-0 rounded-full border ' + (state === 'failed' ? 'border-destructive' : state === 'checking' ? 'border-muted-foreground' : 'border-foreground bg-foreground')} />
        <div className="min-w-0 space-y-1 leading-[1.6]"><p className={'font-medium ' + (state === 'failed' ? 'text-destructive' : state === 'checking' ? 'text-muted-foreground' : '')}>{text(state === 'checking' ? 'checking' : state === 'failed' ? 'disconnected' : 'connected')}</p>{state === 'failed' && <p className="text-muted-foreground">{text('databaseHelp')}</p>}</div>
        {state === 'failed' && <Button variant="outline" onClick={() => void check()} className="ml-auto h-7 shrink-0 rounded-[7px] px-2.5 text-[13px] shadow-none">{text('retry')}</Button>}
      </section>
      {error && <AuthAlert>{error}</AuthAlert>}
      {state === 'complete' && summary ? <div className="space-y-3.5"><dl className="space-y-2">{[['store', summary.siteName], ['ownerSummary', summary.adminUsername + ' · ' + summary.adminEmail], ['timezone', text('timezoneHint', { timezone: summary.timezone })]].map(([label, value]) => <div key={label} className="flex gap-4"><dt className="w-[72px] shrink-0 text-muted-foreground">{text(label)}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}</dl>{login}</div> : state === 'already' ? login : <form onSubmit={submit} className="flex flex-col gap-4">
        {field('siteName', 'storeName', 'text', 'storeHint')}<hr className="border-border" />
        <div className="space-y-1"><h2 className="font-semibold">{text('owner')}</h2><p className="leading-[1.6] text-muted-foreground">{text('ownerHint')}</p></div>
        <div className="grid grid-cols-2 gap-3">{field('adminUsername', 'username')}{field('adminEmail', 'ownerEmail', 'email')}</div><p className="-mt-2 text-xs leading-[1.6] text-faint">{text('usernameHint')}</p>
        <div className="grid grid-cols-2 gap-3">{field('adminPassword', 'password', 'password')}{field('confirm', 'confirm', 'password')}</div><p className="-mt-2 text-xs text-faint">{text('minimum')}</p>
        {mismatch && <p role="alert" id="confirm-error" className="text-xs text-destructive">{text('mismatch')}</p>}
        <Button type="submit" disabled={locked} className={authButtonClass + ' h-[38px] disabled:bg-raised disabled:text-faint disabled:opacity-100'}>{text('completeInstall')}</Button>
      </form>}
    </div>
  </main>;
}

'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useThemeAssets } from '@/lib/theme-assets';
import { authApi, unwrapApiResponse } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const authInputClass = 'h-9 rounded-[7px] border-border bg-transparent px-2.5 text-[13px] shadow-none';
export const authButtonClass = 'h-9 w-full rounded-[7px] text-[13px] font-medium shadow-none';
export function useAuthCopy() {
  const t = useT();
  return (key: string, values?: Record<string, string>) => t('merchant.authFlow.' + key, values);
}

export function AuthLanguage() {
  const locale = useLocale(), pathname = usePathname(), router = useRouter(), text = useAuthCopy();
  return <Select value={locale} onValueChange={value => router.push(pathname.replace(/^\/(en|zh-Hans|zh-Hant)(?=\/|$)/, '/' + value) + window.location.search)}>
    <SelectTrigger aria-label={text('language')} className="h-7 w-auto max-w-full gap-1.5 rounded-[7px] border-border bg-transparent px-2 py-0 text-xs text-muted-foreground [&_svg]:size-2.5"><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="zh-Hans">{text('simplifiedChinese')}</SelectItem><SelectItem value="zh-Hant">{text('traditionalChinese')}</SelectItem><SelectItem value="en">{text('english')}</SelectItem></SelectContent>
  </Select>;
}

export function AuthFrame({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  const { storeName = '', logo, loginBackground } = useThemeAssets(), text = useAuthCopy();
  return <main id="main" style={loginBackground ? { backgroundImage: `url(${JSON.stringify(loginBackground)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} className="admin-auth-page flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-12 text-[13px] text-foreground">
    <div className="flex max-w-full items-center gap-[9px]">
      {logo ? <img src={logo} alt={storeName} className="size-[26px] shrink-0 rounded-[7px] object-contain" /> : storeName && <span aria-hidden="true" className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-foreground font-semibold text-ground">{Array.from(storeName)[0]}</span>}
      <span className="min-w-0 break-words text-[15px] font-semibold">{storeName}</span><span className="shrink-0 text-faint">{text('admin')}</span>
    </div>
    <section className="admin-auth-panel flex w-full max-w-[380px] flex-col gap-[18px] rounded-xl border border-border p-7" aria-labelledby="auth-title">
      <div className="space-y-1.5"><h1 id="auth-title" className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>{description && <p className="leading-[1.6] text-muted-foreground">{description}</p>}</div>
      {children}
    </section>
    <footer className="flex max-w-full flex-wrap items-center justify-center gap-3.5 text-xs text-faint"><AuthLanguage /><span>{text('footer')}</span></footer>
  </main>;
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-lg border border-destructive-line bg-destructive-soft px-3 py-2.5 leading-[1.6] text-destructive">{children}</div>;
}

export function AuthScreen({ mode }: { mode: 'login' | 'forgot' | 'reset' | 'invite' }) {
  const locale = useLocale(), router = useRouter(), params = useSearchParams(), text = useAuthCopy();
  const { login, checkAuth, isAuthenticated, isLoading, isChecking, authError, sessionNotice } = useAuthStore();
  const redirected = useRef(false);
  const [restored, setRestored] = useState(false);
  const [identifier, setIdentifier] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false), [linkState, setLinkState] = useState<'loading' | 'valid' | 'invalid' | 'failed'>('loading');
  const [invitation, setInvitation] = useState<{ email: string; storeName: string } | null>(null);
  const token = params.get('token') || '', loginPath = '/' + locale + '/auth/login';
  useEffect(() => {
    if (mode !== 'login') return;
    let active = true;
    void (async () => { await checkAuth(); if (active) setRestored(true); })();
    return () => { active = false; };
  }, [mode, checkAuth]);
  useEffect(() => {
    if (mode !== 'login') return;
    let active = true;
    void fetch((process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/$/, '') + '/install/status', { credentials: 'include' })
      .then(async response => { if (response.ok && (await response.json()).isInstalled === false && active) router.replace('/' + locale + '/install'); }).catch(() => {});
    return () => { active = false; };
  }, [mode, locale, router]);
  useEffect(() => {
    if (mode !== 'login' || !restored || !isAuthenticated || isLoading || isChecking || authError || redirected.current) return;
    redirected.current = true;
    const redirect = sessionStorage.getItem('redirectPath');
    sessionStorage.removeItem('redirectPath');
    router.replace(redirect?.startsWith('/' + locale + '/') && redirect !== loginPath ? redirect : '/' + locale + '/dashboard');
  }, [mode, restored, isAuthenticated, isLoading, isChecking, authError, locale, loginPath, router]);
  useEffect(() => {
    if (mode !== 'invite' && mode !== 'reset') return;
    let active = true;
    setLinkState('loading'); setDone(false); setInvitation(null);
    if (!token) { setLinkState('invalid'); return; }
    void (mode === 'invite' ? authApi.invite(token) : authApi.inspectReset(token)).then(data => {
      if (!active) return;
      if ('email' in data) setInvitation(data);
      setLinkState('valid');
    }).catch((caught: unknown) => {
      if (active) setLinkState(['INVALID_INVITE_TOKEN', 'INVALID_RESET_TOKEN'].includes((caught as { code?: string })?.code ?? '') ? 'invalid' : 'failed');
    });
    return () => { active = false; };
  }, [mode, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMismatch(false);
    if ((mode === 'reset' || mode === 'invite') && password !== confirm) { setMismatch(true); return; }
    setBusy(true);
    try {
      if (mode === 'login') await login(identifier.trim(), password);
      else if (mode === 'forgot') { unwrapApiResponse(await authApi.forgotPassword(identifier.trim().toLowerCase())); setDone(true); }
      else if (mode === 'reset') { unwrapApiResponse(await authApi.resetPassword({ token, newPassword: password })); setDone(true); }
      else { await authApi.acceptInvite(token, password); setDone(true); }
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      if (code === 'INVALID_INVITE_TOKEN' || code === 'INVALID_RESET_TOKEN') setLinkState('invalid');
      else setError(code === 'CUSTOMER_ACCOUNT_NOT_ADMIN' ? 'customer' : code === 'ADMIN_ACCOUNT_REMOVED' ? 'removed' : code === 'RATE_LIMITED' ? 'rateLimited' : code === 'LOGIN_FAILED' ? 'invalidLogin' : 'failed');
    } finally { setBusy(false); }
  }

  const link = (href: string, label: string, primary = false) => <Link href={href} className={primary ? 'flex h-9 items-center justify-center rounded-[7px] bg-foreground font-medium text-ground focus-visible:outline-2 focus-visible:outline-offset-2' : 'self-center text-muted-foreground underline underline-offset-[3px]'}>{label}</Link>;
  const back = link(loginPath, text('back'));
  if (mode === 'invite' || mode === 'reset') {
    if (linkState === 'loading') return <AuthFrame title={text('loading')} />;
    if (linkState === 'failed') return <AuthFrame title={text('failed')} />;
    if (linkState === 'invalid') return <AuthFrame title={text(mode === 'invite' ? 'inviteInvalid' : 'resetInvalid')} description={text(mode === 'invite' ? 'inviteInvalidDescription' : 'resetInvalidDescription')}>
      {mode === 'reset' && <>{link('/' + locale + '/auth/forgot-password', text('resend'), true)}{back}</>}
    </AuthFrame>;
  }
  const values = { storeName: invitation?.storeName ?? '' };
  if (done) return <AuthFrame title={text(mode === 'forgot' ? 'sent' : mode === 'reset' ? 'resetDone' : 'inviteDone', values)} description={text(mode === 'forgot' ? 'sentDescription' : mode === 'reset' ? 'resetDoneDescription' : 'inviteDoneDescription')}>
    {mode === 'forgot' ? back : link(loginPath, text('goLogin'), true)}
  </AuthFrame>;
  return <AuthFrame title={text(mode === 'invite' ? 'invite' : mode, values)} description={mode === 'login' ? undefined : text(mode + 'Description')}>
    {error && <AuthAlert>{text(error)}</AuthAlert>}
    {mode === 'login' && sessionNotice && !error && <div role="status" className="rounded-lg border border-border bg-raised px-3 py-2.5 leading-[1.6]">{text('signedOut')}</div>}
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      {(mode === 'login' || mode === 'forgot') && <div className="space-y-1.5"><Label htmlFor="identifier" className="text-[13px] font-normal">{text(mode === 'login' ? 'identifier' : 'email')}</Label><Input id="identifier" type={mode === 'forgot' ? 'email' : 'text'} autoComplete={mode === 'login' ? 'username' : 'email'} required value={identifier} onChange={e => setIdentifier(e.target.value)} className={authInputClass} /></div>}
      {mode === 'invite' && <div className="space-y-1.5"><span className="text-muted-foreground">{text('email')}</span><div className="flex min-h-9 items-center break-all rounded-[7px] border border-border bg-raised px-2.5">{invitation?.email}</div></div>}
      {mode !== 'forgot' && <div className="space-y-1.5"><div className="flex items-baseline justify-between gap-2"><Label htmlFor="password" className="text-[13px] font-normal">{text(mode === 'login' ? 'password' : mode === 'invite' ? 'setPassword' : 'newPassword')}</Label>{mode === 'login' && <Link href={'/' + locale + '/auth/forgot-password'} className="text-xs text-muted-foreground underline underline-offset-[3px]">{text('forgotLink')}</Link>}</div><Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} required value={password} onChange={e => setPassword(e.target.value)} aria-describedby={mode === 'login' ? undefined : 'password-hint'} className={authInputClass} />{mode !== 'login' && <p id="password-hint" className="text-xs text-faint">{text('minimum')}</p>}</div>}
      {(mode === 'reset' || mode === 'invite') && <div className="space-y-1.5"><Label htmlFor="confirm" className="text-[13px] font-normal">{text('confirm')}</Label><Input id="confirm" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} aria-invalid={mismatch} aria-describedby={mismatch ? 'confirm-error' : undefined} className={authInputClass} />{mismatch && <p id="confirm-error" role="alert" className="text-xs text-destructive">{text('mismatch')}</p>}</div>}
      <Button type="submit" disabled={busy || (mode === 'login' && isLoading)} className={authButtonClass}>{text(mode === 'login' ? 'signIn' : mode === 'forgot' ? 'sendReset' : mode === 'invite' ? 'join' : 'savePassword')}</Button>
    </form>
    {mode === 'forgot' && back}
  </AuthFrame>;
}

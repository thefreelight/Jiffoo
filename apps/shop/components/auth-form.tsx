'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import type { ShopLocale } from '@/lib/locale';
import { authErrorMessage } from '@/lib/auth-error';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';
import { storefrontMessages } from '@/lib/storefront-messages';
import { authSchema, serverFieldIssues, type AuthValues } from '@/lib/form-validation';

type Mode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email';
type Labels = Record<string, string>;

export function AuthForm({ mode, locale, labels, next, token }: {
  mode: Mode; locale: ShopLocale; labels: Labels; next: string; token?: string;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const router = useRouter();
  const navigate = (href: string) => (event: { preventDefault: () => void }) => {
    event.preventDefault();
    startNavigation(() => router.push(href));
  };
  const t = storefrontMessages(locale).s4;
  const form = useForm<AuthValues>({ resolver: zodResolver(authSchema(mode, t)), shouldFocusError: true,
    defaultValues: { email: '', username: '', password: '', newPassword: '', confirmPassword: '', code: '' } });
  const availability = useShopAvailability(locale);
  const submit = async (data: AuthValues) => {
    if (availability.blocked) return;
    availability.clear();
    setBusy(true);
    setMessage('');
    const path = mode === 'verify-email' ? '/auth/verify-email/code' : `/auth/${mode}`;
    const payload = mode === 'login'
      ? { identifier: data.email, password: data.password, surface: 'storefront' }
      : mode === 'register' ? { username: data.username, email: data.email, password: data.password, locale }
        : mode === 'reset-password' ? { token, newPassword: data.newPassword }
          : mode === 'verify-email' ? { email: data.email, code: data.code } : { email: data.email };
    try {
      const response = await availabilityFetch(`/bff${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { success: boolean; error?: { code: string } };
      if (mode === 'forgot-password') {
        setMessage(t.forgotReceived);
      } else if (response.ok && result.success) {
        if (mode === 'login') window.location.assign(next);
        else if (mode === 'register' || mode === 'verify-email') window.location.assign(`/${locale}/account`);
        else setMessage(labels.passwordUpdated);
      } else {
        const message = authErrorMessage(response.status, result.error?.code, labels, mode);
        const passwordRejected = mode === 'login' && result.error?.code === 'LOGIN_FAILED';
        if (passwordRejected) form.setError('password', { type: 'server', message }, { shouldFocus: true });
        for (const key of serverFieldIssues(result)) if (key in data) form.setError(key as keyof AuthValues, { type: 'server', message: t.invalidField }, { shouldFocus: true });
        if (!passwordRejected) setMessage(message);
      }
    } catch (error) {
      if (availability.capture(error)) return;
      setMessage(mode === 'forgot-password' ? t.forgotReceived : labels.genericError);
    } finally {
      setBusy(false);
    }
  };
  const title = mode === 'forgot-password' ? t.forgotTitle : mode === 'reset-password' ? t.resetTitle : labels[mode === 'verify-email' ? 'verify' : mode];
  const field = (name: keyof AuthValues, label: string, type = 'text') => <div>
    <div className="mb-1.5 flex items-center justify-between text-[13px]"><label htmlFor={`auth-${name}`} className="font-medium">{label}</label>
      {name === 'password' && mode === 'login' && <Link href={`/${locale}/forgot-password`} onNavigate={navigate(`/${locale}/forgot-password`)} className="text-subtle">{t.forgotLink}</Link>}</div>
    <input id={`auth-${name}`} {...form.register(name)} type={type} aria-required="true" aria-invalid={!!form.formState.errors[name]}
      aria-describedby={form.formState.errors[name] ? `auth-error-${name}` : name === 'password' && mode === 'register' ? 'password-hint' : undefined}
      autoComplete={type === 'password' ? mode === 'login' ? 'current-password' : 'new-password' : name === 'email' ? 'email' : name === 'username' ? 'username' : 'one-time-code'}
      className="h-10 w-full rounded-md border border-[var(--shop-border-strong)] bg-canvas px-3 aria-invalid:border-destructive" />
    {form.formState.errors[name] && <p id={`auth-error-${name}`} role="alert" className="mt-1.5 text-xs text-destructive">{form.formState.errors[name]?.message}</p>}
  </div>;
  return <main className="mx-auto max-w-[432px] px-4 pb-24 pt-[72px]">
    {mode === 'forgot-password' && <Link href={`/${locale}/login`} onNavigate={navigate(`/${locale}/login`)} className="mb-5 inline-block text-subtle">{t.backLogin}</Link>}
    <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
    {(mode === 'login' || mode === 'register') && <p className="mt-3 text-subtle">{mode === 'login' ? t.noAccount : labels.alreadyAccount}{' '}
      <Link href={`/${locale}/${mode === 'login' ? 'register' : 'login'}?next=${encodeURIComponent(next)}`} onNavigate={navigate(`/${locale}/${mode === 'login' ? 'register' : 'login'}?next=${encodeURIComponent(next)}`)} className="text-ink underline">{mode === 'login' ? storefrontMessages(locale).navigation.register : labels.login}</Link></p>}
    {mode === 'forgot-password' && <p className="mt-3 text-subtle">{t.forgotBody}</p>}
    <form noValidate aria-label={title} aria-busy={busy || navigating} onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-5">
      <fieldset disabled={busy || navigating || availability.blocked} className="space-y-5">
        {mode === 'register' && field('username', labels.username)}
        {mode !== 'reset-password' && field('email', labels.email, mode === 'login' ? 'text' : 'email')}
        {(mode === 'login' || mode === 'register') && field('password', labels.password, 'password')}
        {mode === 'register' && <p id="password-hint" className="-mt-3 text-xs text-subtle">{t.registerHint}</p>}
        {mode === 'reset-password' && <>{field('newPassword', labels.newPassword, 'password')}{field('confirmPassword', t.confirmPassword, 'password')}</>}
        {mode === 'verify-email' && field('code', labels.code)}
      </fieldset>
      <button type="submit" disabled={busy || navigating || availability.blocked} className="h-12 w-full rounded-md bg-action px-6 text-[15px] font-medium text-action-ink disabled:opacity-45">{mode === 'forgot-password' ? labels.sendReset : mode === 'reset-password' ? t.savePassword : mode === 'register' ? t.registerAction : title}</button>
    </form>
    {(availability.message || message) && <p role="status" className="mt-5 rounded-lg bg-highlight p-3.5 text-[13px]">{availability.message || message}</p>}
    {mode === 'register' && <p className="mt-5 text-center text-xs text-subtle">{t.registerMail}</p>}
  </main>;
}

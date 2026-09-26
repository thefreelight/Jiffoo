'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { ShopLocale } from '@/lib/locale';
import { authErrorMessage } from '@/lib/auth-error';

type Mode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email';
type Labels = Record<string, string>;

export function AuthForm({ mode, locale, labels, next, token }: {
  mode: Mode; locale: ShopLocale; labels: Labels; next: string; token?: string;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const path = mode === 'verify-email' ? '/auth/verify-email/code' : `/auth/${mode}`;
    const payload = mode === 'login'
      ? { identifier: data.email, password: data.password }
      : mode === 'register' ? { ...data, locale }
        : mode === 'reset-password' ? { token, newPassword: data.newPassword }
          : data;
    try {
      const response = await fetch(`/bff${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { success: boolean; error?: { code: string } };
      if (mode === 'forgot-password') {
        setMessage(labels.requestReceived);
      } else if (response.ok && result.success) {
        if (mode === 'login') window.location.assign(next);
        else if (mode === 'register' || mode === 'verify-email') window.location.assign(`/${locale}/account`);
        else setMessage(labels.passwordUpdated);
      } else setMessage(authErrorMessage(response.status, result.error?.code, labels, mode));
    } catch {
      setMessage(mode === 'forgot-password' ? labels.requestReceived : labels.verificationFailed);
    } finally {
      setBusy(false);
    }
  };
  const title = labels[mode === 'forgot-password' ? 'forgot' : mode === 'reset-password' ? 'reset' : mode === 'verify-email' ? 'verify' : mode];
  return <main className="mx-auto max-w-md px-4 py-12">
    <h1 className="text-2xl font-semibold">{title}</h1>
    <form onSubmit={submit} className="mt-8 space-y-5">
      {mode === 'register' && <label className="block text-sm">{labels.username}<input name="username" required minLength={3} className="mt-1 w-full rounded-shop border border-line bg-surface p-2 text-ink" /></label>}
      {mode !== 'reset-password' && <label className="block text-sm">{labels.email}<input name="email" type="email" required className="mt-1 w-full rounded-shop border border-line bg-surface p-2 text-ink" /></label>}
      {(mode === 'login' || mode === 'register') && <label className="block text-sm">{labels.password}<input name="password" type="password" required minLength={6} className="mt-1 w-full rounded-shop border border-line bg-surface p-2 text-ink" /></label>}
      {mode === 'reset-password' && <label className="block text-sm">{labels.newPassword}<input name="newPassword" type="password" required minLength={6} className="mt-1 w-full rounded-shop border border-line bg-surface p-2 text-ink" /></label>}
      {mode === 'verify-email' && <label className="block text-sm">{labels.code}<input name="code" inputMode="numeric" pattern="[0-9]{6}" required className="mt-1 w-full rounded-shop border border-line bg-surface p-2 text-ink" /></label>}
      <button type="submit" disabled={busy} className="rounded-shop bg-action px-4 py-2 text-action-ink disabled:opacity-50">{mode === 'forgot-password' ? labels.sendReset : title}</button>
    </form>
    {message && <p role="status" className="mt-5 text-sm text-action">{message}</p>}
    {mode === 'login' && <nav className="mt-7 flex gap-5 text-sm text-action">
      <Link href={`/${locale}/forgot-password`}>{labels.forgot}</Link>
      <Link href={`/${locale}/register?next=${encodeURIComponent(next)}`}>{labels.register}</Link>
    </nav>}
    {mode === 'register' && <Link href={`/${locale}/login?next=${encodeURIComponent(next)}`} className="mt-7 block text-sm text-action">{labels.alreadyAccount}</Link>}
  </main>;
}

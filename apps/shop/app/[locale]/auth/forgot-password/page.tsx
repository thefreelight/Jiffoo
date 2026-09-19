'use client';

import { useState } from 'react';
import { KeyRound, Loader2, MailCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';

type Step = 'email' | 'reset' | 'done';

/**
 * Forgot password — request a reset code, then set a new password.
 * The core sends a six-digit code by email; this page collects it with the
 * new password and completes the reset.
 */
export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const nav = useLocalizedNavigation();
  const presetEmail = searchParams.get('email')?.trim().toLowerCase() || '';

  const [step, setStep] = useState<Step>(presetEmail ? 'reset' : 'email');
  const [email, setEmail] = useState(presetEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword(value);
      setStep('reset');
      setNotice(`If an account exists for ${value}, a six-digit reset code is on its way. It expires in 10 minutes.`);
    } catch (caught: any) {
      setError(caught?.message || 'Could not send the reset code. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the six-digit code from the email.');
      return;
    }
    if (password.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword({ email: email.trim().toLowerCase(), code: code.trim(), password });
      setStep('done');
    } catch (caught: any) {
      setError(caught?.message || 'Could not reset the password. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e8f4ff,transparent_32%),linear-gradient(135deg,#f8fbff_0%,#eef6f1_100%)] px-6 py-16">
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(30,64,175,0.14)] backdrop-blur">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white">
            {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : step === 'done' ? <MailCheck className="h-7 w-7" /> : <KeyRound className="h-7 w-7" />}
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
            Password recovery
          </p>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-slate-950">
            {step === 'email' ? 'Forgot your password?' : step === 'reset' ? 'Check your email' : 'Password updated'}
          </h1>
          <p className="mx-auto mb-8 max-w-md text-sm leading-6 text-slate-600">
            {step === 'email'
              ? 'Enter the email on your account and we will send a six-digit reset code.'
              : step === 'reset'
                ? notice || 'Enter the six-digit code and choose a new password.'
                : 'Your password has been changed. Sign in with the new password.'}
          </p>

          {error ? (
            <p className="mx-auto mb-6 max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          {step === 'email' ? (
            <form onSubmit={submitEmail} className="mx-auto max-w-sm space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-950 outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                Send reset code
              </button>
            </form>
          ) : null}

          {step === 'reset' ? (
            <form onSubmit={submitReset} className="mx-auto max-w-sm space-y-4">
              <input
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Six-digit code"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-center text-lg font-bold tracking-[0.4em] text-slate-950 outline-none focus:border-blue-500"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="New password (8+ characters)"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-950 outline-none focus:border-blue-500"
              />
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Confirm new password"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-950 outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                Reset password
              </button>
            </form>
          ) : null}

          {step === 'done' ? (
            <button
              type="button"
              onClick={() => nav.push('/auth/login')}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-8 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              Back to sign in
            </button>
          ) : null}

          <p className="mt-8 text-xs text-slate-500">
            <button type="button" onClick={() => nav.push('/auth/login')} className="underline underline-offset-4 hover:text-slate-700">
              Back to sign in
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

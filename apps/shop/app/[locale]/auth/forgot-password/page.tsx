'use client';

import { Suspense, useState } from 'react';
import { KeyRound, Loader2, MailCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';

type Step = 'email' | 'reset' | 'done';

/**
 * Forgot password — request a reset code, then set a new password.
 * The core sends a six-digit code by email; this page collects it with the
 * new password and completes the reset. When the active theme provides a
 * ForgotPasswordPage component it renders that; otherwise the built-in
 * form below is the fallback.
 */
function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const nav = useLocalizedNavigation();
  const { theme, config } = useShopTheme();
  const presetEmail = searchParams.get('email')?.trim().toLowerCase() || '';

  const [step, setStep] = useState<Step>(presetEmail ? 'reset' : 'email');
  const [email, setEmail] = useState(presetEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Throwing handlers: the theme component catches and displays rejections
  // itself; the built-in fallback below wraps them and keeps error state.
  // busy drives the isLoading prop for both paths.
  const requestCode = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized.includes('@')) {
      throw new Error('Enter a valid email address.');
    }
    setBusy(true);
    try {
      // ApiClient resolves every failure as { success: false } — surface the
      // server message instead of advancing on a failed request.
      const sent = await authApi.forgotPassword(normalized);
      if (!sent.success) {
        throw new Error(sent.error?.message || 'Could not send the reset code. Try again in a moment.');
      }
      setEmail(normalized);
      setStep('reset');
      setNotice(`If an account exists for ${normalized}, a six-digit reset code is on its way. It expires in 10 minutes.`);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (input: { email: string; code: string; password: string }) => {
    if (!/^\d{6}$/.test(input.code.trim())) {
      throw new Error('Enter the six-digit code from the email.');
    }
    if (input.password.length < 8) {
      throw new Error('The new password must be at least 8 characters.');
    }
    setBusy(true);
    try {
      const reset = await authApi.resetPassword({ email: input.email.trim().toLowerCase(), code: input.code.trim(), password: input.password });
      if (!reset.success) {
        throw new Error(reset.error?.message || 'Could not reset the password. Check the code and try again.');
      }
      setStep('done');
    } finally {
      setBusy(false);
    }
  };

  const ThemeForgotPassword = theme?.components?.ForgotPasswordPage;
  if (ThemeForgotPassword) {
    return (
      <ThemeForgotPassword
        isLoading={busy}
        error={error || null}
        config={config}
        initialEmail={presetEmail}
        onRequestCode={requestCode}
        onResetPassword={resetPassword}
        onNavigateToLogin={() => nav.push('/auth/login')}
      />
    );
  }

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    requestCode(email).catch((cause: unknown) => setError(cause instanceof Error && cause.message ? cause.message : 'Could not send the reset code. Try again in a moment.'));
  };

  const submitReset = (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setError('');
    resetPassword({ email, code, password }).catch((cause: unknown) => setError(cause instanceof Error && cause.message ? cause.message : 'Could not reset the password. Check the code and try again.'));
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

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}

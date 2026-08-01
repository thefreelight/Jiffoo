'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MailCheck, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

type VerificationState = 'idle' | 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nav = useLocalizedNavigation();
  const t = useT();
  const email = searchParams.get('email')?.trim() || '';
  const token = searchParams.get('token')?.trim() || '';
  const [state, setState] = useState<VerificationState>(token ? 'loading' : 'idle');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  useEffect(() => {
    let cancelled = false;

    async function verifyEmail() {
      if (!token) {
        setState(email ? 'idle' : 'error');
        setMessage(email
          ? getText('shop.auth.verifyEmail.codePrompt', `Enter the code sent to ${email}.`)
          : getText('shop.auth.verifyEmail.missingToken', 'Verification email is missing.'));
        return;
      }

      try {
        await authApi.verifyEmail(token);
        if (cancelled) return;
        setState('success');
        setMessage(getText('shop.auth.verifyEmail.successMessage', 'Your email has been verified. You can now sign in.'));
      } catch (error: any) {
        if (cancelled) return;
        setState('error');
        setMessage(error?.message || getText('shop.auth.verifyEmail.failedMessage', 'Email verification failed.'));
      }
    }

    verifyEmail();

    return () => {
      cancelled = true;
    };
  }, [email, token, t]);

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !/^\d{6}$/.test(code)) return;
    setState('loading');
    setMessage(getText('shop.auth.verifyEmail.loadingMessage', 'Checking your verification code.'));
    try {
      await authApi.verifyEmailCode(email, code);
      setState('success');
      setMessage(getText('shop.auth.verifyEmail.successMessage', 'Your email has been verified. You can now sign in.'));
    } catch (error: any) {
      setState('error');
      setMessage(error?.message || getText('shop.auth.verifyEmail.failedMessage', 'Email verification failed.'));
    }
  };

  const resendCode = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      await authApi.resendVerification(email);
      setState('idle');
      setCode('');
      setMessage(getText('shop.auth.verifyEmail.resent', `A new code was sent to ${email}.`));
    } catch (error: any) {
      setState('error');
      setMessage(error?.message || getText('shop.auth.verifyEmail.resendFailed', 'Could not resend the code.'));
    } finally {
      setResending(false);
    }
  };

  const isSuccess = state === 'success';
  const isLoading = state === 'loading';
  const isCodeFlow = Boolean(email && !token && !isSuccess);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e8f4ff,transparent_32%),linear-gradient(135deg,#f8fbff_0%,#eef6f1_100%)] px-6 py-16">
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(30,64,175,0.14)] backdrop-blur">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white">
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : state === 'idle' ? (
              <MailCheck className="h-7 w-7" />
            ) : (
              <XCircle className="h-7 w-7" />
            )}
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
            {getText('shop.auth.verifyEmail.eyebrow', 'Account verification')}
          </p>
          <h1 className="mb-4 text-3xl font-black tracking-tight text-slate-950">
            {isLoading
              ? getText('shop.auth.verifyEmail.loadingTitle', 'Verifying your email')
              : isSuccess
                ? getText('shop.auth.verifyEmail.successTitle', 'Email verified')
                : state === 'idle'
                  ? getText('shop.auth.verifyEmail.codeTitle', 'Enter verification code')
                : getText('shop.auth.verifyEmail.failedTitle', 'Verification failed')}
          </h1>
          <p className="mx-auto mb-8 max-w-md text-sm leading-6 text-slate-600">
            {message || getText('shop.auth.verifyEmail.loadingMessage', 'Please wait while we confirm your invite.')}
          </p>

          {isCodeFlow ? (
            <form onSubmit={submitCode} className="mx-auto mb-8 max-w-sm space-y-4">
              <label className="block text-left">
                <span className="text-xs font-semibold text-slate-700">
                  {getText('shop.auth.verifyEmail.codeLabel', 'Six-digit code')}
                </span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={getText('shop.auth.verifyEmail.codeLabel', 'Six-digit code')}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-center font-mono text-xl tracking-[0.32em] text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                  disabled={isLoading}
                />
              </label>
              <Button type="submit" disabled={code.length !== 6 || isLoading} className="w-full rounded-lg bg-slate-950 text-white hover:bg-slate-800">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {getText('shop.auth.verifyEmail.submitCode', 'Verify email')}
              </Button>
              <button type="button" onClick={resendCode} disabled={resending || isLoading} className="text-sm font-medium text-slate-700 underline underline-offset-4 disabled:opacity-50">
                {resending ? getText('shop.auth.verifyEmail.resending', 'Sending...') : getText('shop.auth.verifyEmail.resend', 'Send a new code')}
              </button>
            </form>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={() => nav.push('/auth/login')}
              className="rounded-2xl bg-slate-950 px-6 text-white hover:bg-slate-800"
            >
              {getText('shop.auth.verifyEmail.goToLogin', 'Go to login')}
            </Button>
            {!isSuccess && !isLoading && !isCodeFlow && (
              <Button
                variant="outline"
                onClick={() => router.refresh()}
                className="rounded-2xl"
              >
                {getText('common.actions.retry', 'Retry')}
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

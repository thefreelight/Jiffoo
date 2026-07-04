'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

type VerificationState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nav = useLocalizedNavigation();
  const t = useT();
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('');

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  useEffect(() => {
    let cancelled = false;

    async function verifyEmail() {
      const token = searchParams.get('token');
      if (!token) {
        setState('error');
        setMessage(getText('shop.auth.verifyEmail.missingToken', 'Verification token is missing.'));
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
  }, [searchParams, t]);

  const isSuccess = state === 'success';
  const isLoading = state === 'loading';

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e8f4ff,transparent_32%),linear-gradient(135deg,#f8fbff_0%,#eef6f1_100%)] px-6 py-16">
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(30,64,175,0.14)] backdrop-blur">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white">
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-7 w-7" />
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
                : getText('shop.auth.verifyEmail.failedTitle', 'Verification failed')}
          </h1>
          <p className="mx-auto mb-8 max-w-md text-sm leading-6 text-slate-600">
            {message || getText('shop.auth.verifyEmail.loadingMessage', 'Please wait while we confirm your invite.')}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={() => nav.push('/auth/login')}
              className="rounded-2xl bg-slate-950 px-6 text-white hover:bg-slate-800"
            >
              {getText('shop.auth.verifyEmail.goToLogin', 'Go to login')}
            </Button>
            {!isSuccess && !isLoading && (
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

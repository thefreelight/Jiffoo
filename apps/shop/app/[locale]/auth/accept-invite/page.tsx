'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const nav = useLocalizedNavigation();
  const t = useT();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  const token = searchParams.get('token') || '';
  const adminUrl = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_ADMIN_URL || '';
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}/${nav.locale}/auth/login` : '';
  }, [nav.locale]);

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError(getText('shop.auth.acceptInvite.missingToken', 'Invitation token is missing.'));
      return;
    }

    if (password.length < 6) {
      setError(getText('shop.auth.acceptInvite.passwordTooShort', 'Password must be at least 6 characters.'));
      return;
    }

    if (password !== confirmPassword) {
      setError(getText('shop.auth.acceptInvite.passwordMismatch', 'Passwords do not match.'));
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.acceptStaffInvite({ token, password });
      setAccepted(true);
    } catch (err: any) {
      setError(err?.message || getText('shop.auth.acceptInvite.failed', 'Unable to accept this invitation.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#dbeafe,transparent_34%),radial-gradient(circle_at_80%_20%,#dcfce7,transparent_28%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-16">
      <section className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
              {accepted ? <CheckCircle2 className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
                {getText('shop.auth.acceptInvite.eyebrow', 'Staff invitation')}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                {accepted
                  ? getText('shop.auth.acceptInvite.acceptedTitle', 'Invite accepted')
                  : getText('shop.auth.acceptInvite.title', 'Set your admin password')}
              </h1>
            </div>
          </div>

          {accepted ? (
            <div className="space-y-6">
              <p className="text-sm leading-6 text-slate-600">
                {getText('shop.auth.acceptInvite.acceptedMessage', 'Your staff account is active. Continue to the admin console and sign in with your new password.')}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="rounded-2xl bg-slate-950 px-6 text-white hover:bg-slate-800"
                  onClick={() => {
                    if (adminUrl) {
                      window.location.href = adminUrl;
                    } else {
                      nav.push('/auth/login');
                    }
                  }}
                >
                  {getText('shop.auth.acceptInvite.openAdmin', 'Open admin login')}
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => nav.push('/')}>
                  {getText('common.actions.backToHome', 'Back to home')}
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <p className="text-sm leading-6 text-slate-600">
                {getText('shop.auth.acceptInvite.description', 'Choose a password to activate your staff account. This invite link expires after 24 hours.')}
              </p>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="password">
                  {getText('shop.auth.acceptInvite.password', 'Password')}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-2xl pl-11"
                    placeholder={getText('shop.auth.acceptInvite.passwordPlaceholder', 'At least 6 characters')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="confirm-password">
                  {getText('shop.auth.acceptInvite.confirmPassword', 'Confirm password')}
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder={getText('shop.auth.acceptInvite.confirmPasswordPlaceholder', 'Enter it again')}
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {getText('shop.auth.acceptInvite.submitting', 'Activating...')}
                  </span>
                ) : (
                  getText('shop.auth.acceptInvite.submit', 'Accept invite')
                )}
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

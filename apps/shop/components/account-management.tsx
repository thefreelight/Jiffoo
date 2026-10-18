'use client';

import { useState, type FormEvent } from 'react';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';

type Profile = { username: string; email: string; locale: string | null; emailVerified: boolean };

export function AccountManagement({ locale, profile: initial, labels, locales, navigation }: {
  locale: ShopLocale;
  profile: Profile;
  labels: Record<string, string>;
  locales: ShopLocale[];
  navigation: React.ReactNode;
}) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const availability = useShopAvailability(locale);
  const t = storefrontMessages(locale).s4;
  const submit = (path: string, method: string, onSuccess?: (data: Profile) => void) =>
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (availability.blocked) return;
      availability.clear();
      setMessage('');
      setError('');
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        const response = await availabilityFetch(`/bff${path}`, {
          method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const result = await response.json() as { success: boolean; data?: Profile; error?: { code: string } };
        if (!response.ok || !result.success) {
          setError(result.error?.code === 'INVALID_PASSWORD' ? labels.invalidPassword : labels.verificationFailed);
          return;
        }
        if (method === 'DELETE') {
          window.location.assign(`/${locale}/login`);
          return;
        }
        if (onSuccess && result.data) onSuccess(result.data);
        setMessage(path === '/auth/change-password' ? labels.passwordUpdated : labels.accountUpdated);
      } catch (error) {
        if (availability.capture(error)) return;
        setError(labels.verificationFailed);
      }
    };
  const resend = async () => {
    if (availability.blocked) return;
    availability.clear();
    let unavailable = false;
    try {
      await availabilityFetch('/bff/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile.email }),
      });
    } catch (error) {
      unavailable = availability.capture(error);
      if (!unavailable) throw error;
    } finally {
      if (!unavailable) { setMessage(labels.requestReceived); setError(''); }
    }
  };
  const field = (label: string, name: string, value?: string, type = 'text') =>
    <label className="block text-sm">{label}<input name={name} type={type} defaultValue={value}
      onInvalid={(event) => { const input = event.currentTarget; input.setCustomValidity(input.validity.valueMissing ? t.required : type === 'email' ? t.invalidEmail : name === 'username' && input.validity.tooShort ? t.usernameMin : type === 'password' ? t.passwordMin : t.invalidField); }}
      onInput={(event) => event.currentTarget.setCustomValidity('')}
      required minLength={name === 'username' ? 3 : type === 'password' && name !== 'currentPassword' ? 6 : undefined}
      maxLength={name === 'username' ? 50 : undefined} className="mt-1 h-10 w-full rounded-md border border-[var(--shop-border-strong)] bg-canvas px-3 text-ink" /></label>;
  return <main className="mx-auto min-h-[620px] max-w-7xl px-4 pb-14 pt-9 md:px-8">
    {navigation}
    <div className="max-w-[520px] space-y-6">
    {!profile.emailVerified && <section aria-label={labels.unverified} className="border-l-2 border-action pl-4">
      <p>{labels.unverified}</p>
      <button type="button" disabled={availability.blocked} onClick={resend} className="mt-2 text-sm text-action underline">{labels.resend}</button>
    </section>}
    <section aria-label={labels.profile} className="space-y-4">
      <label className="block text-[13px] font-medium">{labels.email}<input value={profile.email} disabled className="mt-1.5 h-10 w-full rounded-md border border-line bg-canvas px-3" /></label>
      {profile.emailVerified && <span className="inline-flex h-[22px] items-center rounded-md bg-highlight px-2 text-xs font-medium text-[var(--shop-extras-success)]">{t.verified}</span>}
      <form onSubmit={submit('/account/profile', 'PUT', (data) => setProfile(data))} className="space-y-4">
        {field(labels.username, 'username', profile.username)}
        <p className="text-xs text-subtle">{t.usernameHint}</p>
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.submit}</button>
      </form>
    </section>
    <details className="border-t border-line pt-5"><summary className="cursor-pointer font-medium">{labels.language}</summary><section aria-label={labels.language} className="mt-4">
      <h2 className="mb-4 text-lg font-semibold">{labels.language}</h2>
      <form onSubmit={submit('/account/profile', 'PUT', (data) => setProfile(data))} className="space-y-4">
        <label className="block text-sm">{labels.language}
          <select name="locale" defaultValue={profile.locale || locale} className="mt-1 w-full rounded-shop border border-line bg-[var(--shop-core-raised)] p-2 text-ink">
            {locales.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.submit}</button>
      </form>
    </section></details>
    <details className="border-t border-line pt-5"><summary className="cursor-pointer font-medium">{labels.changeEmail}</summary><section aria-label={labels.changeEmail} className="mt-4">
      <h2 className="mb-4 text-lg font-semibold">{labels.changeEmail}</h2>
      <p className="mb-4 text-sm text-subtle">{profile.email}</p>
      <form onSubmit={submit('/account/email', 'PUT', (data) => setProfile(data))} className="space-y-4">
        {field(labels.newEmail, 'newEmail', undefined, 'email')}
        {field(labels.currentPassword, 'currentPassword', undefined, 'password')}
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.changeEmail}</button>
      </form>
    </section></details>
    <details className="border-t border-line pt-5"><summary className="cursor-pointer font-medium">{labels.changePassword}</summary><section aria-label={labels.changePassword} className="mt-4">
      <h2 className="mb-4 text-lg font-semibold">{labels.changePassword}</h2>
      <form onSubmit={submit('/auth/change-password', 'POST')} className="space-y-4">
        {field(labels.currentPassword, 'currentPassword', undefined, 'password')}
        {field(labels.newPassword, 'newPassword', undefined, 'password')}
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.changePassword}</button>
      </form>
    </section></details>
    <details className="border-t border-line pt-5"><summary className="cursor-pointer font-medium">{labels.deleteAccount}</summary><section aria-label={labels.deleteAccount} className="mt-4">
      <h2 className="mb-3 text-lg font-semibold">{labels.deleteAccount}</h2>
      <p className="mb-4 text-sm text-subtle">{labels.deleteWarning}</p>
      <form onSubmit={submit('/account', 'DELETE')} className="space-y-4">
        {field(labels.currentPassword, 'currentPassword', undefined, 'password')}
        <button disabled={availability.blocked} className="rounded-shop border border-line px-4 py-2 text-ink">{labels.deleteAccount}</button>
      </form>
    </section></details>
    {message && <p role="status" className="text-action">{message}</p>}
    {(availability.message || error) && <p role="alert" className="text-ink">{availability.message || error}</p>}
    </div>
  </main>;
}

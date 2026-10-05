'use client';

import { useState, type FormEvent } from 'react';
import type { ShopLocale } from '@/lib/locale';
import Link from 'next/link';
import { availabilityFetch, useShopAvailability } from '@/lib/client-availability';

type Profile = { username: string; email: string; locale: string | null; emailVerified: boolean };

export function AccountManagement({ locale, profile: initial, labels, locales }: {
  locale: ShopLocale;
  profile: Profile;
  labels: Record<string, string>;
  locales: ShopLocale[];
}) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const availability = useShopAvailability(locale);
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
      required className="mt-1 w-full rounded-shop border border-line bg-surface p-2 text-ink" /></label>;
  return <main className="mx-auto max-w-3xl space-y-9 px-4 py-10">
    <h1 className="text-2xl font-semibold">{labels.profile}</h1>
    <Link href={`/${locale}/account/orders`} className="inline-block text-action underline">{labels.orders}</Link>
    {!profile.emailVerified && <section aria-label={labels.unverified} className="border-l-2 border-action pl-4">
      <p>{labels.unverified}</p>
      <button type="button" disabled={availability.blocked} onClick={resend} className="mt-2 text-sm text-action underline">{labels.resend}</button>
    </section>}
    <section aria-label={labels.profile} className="border-t border-line pt-5">
      <h2 className="mb-4 text-lg font-semibold">{labels.profile}</h2>
      <form onSubmit={submit('/account/profile', 'PUT', (data) => setProfile(data))} className="space-y-4">
        {field(labels.username, 'username', profile.username)}
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.submit}</button>
      </form>
    </section>
    <section aria-label={labels.language} className="border-t border-line pt-5">
      <h2 className="mb-4 text-lg font-semibold">{labels.language}</h2>
      <form onSubmit={submit('/account/profile', 'PUT', (data) => setProfile(data))} className="space-y-4">
        <label className="block text-sm">{labels.language}
          <select name="locale" defaultValue={profile.locale || locale} className="mt-1 w-full rounded-shop border border-line bg-surface p-2 text-ink">
            {locales.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.submit}</button>
      </form>
    </section>
    <section aria-label={labels.changeEmail} className="border-t border-line pt-5">
      <h2 className="mb-4 text-lg font-semibold">{labels.changeEmail}</h2>
      <p className="mb-4 text-sm text-subtle">{profile.email}</p>
      <form onSubmit={submit('/account/email', 'PUT', (data) => setProfile(data))} className="space-y-4">
        {field(labels.newEmail, 'newEmail', undefined, 'email')}
        {field(labels.currentPassword, 'currentPassword', undefined, 'password')}
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.changeEmail}</button>
      </form>
    </section>
    <section aria-label={labels.changePassword} className="border-t border-line pt-5">
      <h2 className="mb-4 text-lg font-semibold">{labels.changePassword}</h2>
      <form onSubmit={submit('/auth/change-password', 'POST')} className="space-y-4">
        {field(labels.currentPassword, 'currentPassword', undefined, 'password')}
        {field(labels.newPassword, 'newPassword', undefined, 'password')}
        <button disabled={availability.blocked} className="rounded-shop bg-action px-4 py-2 text-action-ink">{labels.changePassword}</button>
      </form>
    </section>
    <section aria-label={labels.deleteAccount} className="border-t border-line pt-5">
      <h2 className="mb-3 text-lg font-semibold">{labels.deleteAccount}</h2>
      <p className="mb-4 text-sm text-subtle">{labels.deleteWarning}</p>
      <form onSubmit={submit('/account', 'DELETE')} className="space-y-4">
        {field(labels.currentPassword, 'currentPassword', undefined, 'password')}
        <button disabled={availability.blocked} className="rounded-shop border border-line px-4 py-2 text-ink">{labels.deleteAccount}</button>
      </form>
    </section>
    {message && <p role="status" className="text-action">{message}</p>}
    {(availability.message || error) && <p role="alert" className="text-ink">{availability.message || error}</p>}
  </main>;
}

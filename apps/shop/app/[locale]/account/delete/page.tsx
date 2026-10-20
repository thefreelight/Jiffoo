'use client';

import * as React from 'react';
import { AlertTriangle, ArrowLeft, Check, LogIn, Trash2 } from 'lucide-react';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type DeleteState = 'idle' | 'deleting' | 'deleted' | 'error';

export default function DeleteAccountPage() {
  const nav = useLocalizedNavigation();
  const { isAuthenticated, logout } = useAuthStore();
  const [confirmed, setConfirmed] = React.useState(false);
  const [state, setState] = React.useState<DeleteState>('idle');
  const [message, setMessage] = React.useState('');

  const deleteAccount = async () => {
    setState('deleting');
    setMessage('');
    try {
      const response = await apiClient.delete('/account');
      if (!response.success) {
        throw new Error(response.error?.message || 'Account deletion could not be completed.');
      }
      logout();
      setState('deleted');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Account deletion could not be completed.');
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bokmoo-bg)] px-4 py-16 text-[var(--bokmoo-ink)] sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => nav.push('/')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bokmoo-gold)]"
        >
          <ArrowLeft className="h-4 w-4" />
          BOKMOO home
        </button>

        <div className="mt-14 grid gap-10 border-t border-[var(--bokmoo-line)] pt-10 md:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--bokmoo-gold)]">Account control</p>
            <h1
              className="mt-4 break-words text-3xl font-semibold leading-tight sm:text-5xl"
              style={{ color: 'var(--bokmoo-ink)' }}
            >
              Delete your BOKMOO account
            </h1>
          </div>

          <section aria-live="polite">
            {state === 'deleted' ? (
              <div className="border-l-2 border-emerald-500 pl-6">
                <Check className="h-7 w-7 text-emerald-500" />
                <h2 className="mt-5 text-2xl font-semibold">Your deletion request is complete.</h2>
                <p className="mt-3 leading-7 text-[var(--bokmoo-copy)]">Your session has been closed. Installed eSIM profiles remain on your device until you remove them in device settings.</p>
              </div>
            ) : !isAuthenticated ? (
              <div>
                <p className="leading-7 text-[var(--bokmoo-copy)]">Sign in to verify ownership, then return here to permanently delete the account and associated personal data.</p>
                <button type="button" onClick={() => nav.push('/auth/login?redirect=/account/delete')} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-4 text-center text-sm font-semibold text-[var(--bokmoo-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bokmoo-gold)] sm:w-auto sm:px-6 sm:text-base">
                  <LogIn className="h-4 w-4" /> Sign in to continue
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-4 border-b border-[var(--bokmoo-line)] pb-7">
                  <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-[var(--bokmoo-gold)]" />
                  <p className="leading-7 text-[var(--bokmoo-copy)]">This action cannot be undone. Active orders and records that must be retained for legal, fraud-prevention, or accounting purposes may be kept only for the required retention period.</p>
                </div>

                <label className="mt-8 flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 accent-[var(--bokmoo-gold)]" />
                  <span className="text-sm leading-6 text-[var(--bokmoo-copy)]">I understand that my BOKMOO account and associated personal data will be deleted.</span>
                </label>

                {state === 'error' && <p className="mt-5 text-sm font-semibold text-red-500">{message}</p>}

                <button type="button" disabled={!confirmed || state === 'deleting'} onClick={deleteAccount} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 bg-red-600 px-4 text-center text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500 sm:w-auto sm:px-6 sm:text-base">
                  <Trash2 className="h-4 w-4" /> {state === 'deleting' ? 'Deleting account...' : 'Delete account permanently'}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

import React from 'react';
import { CreditCard, KeyRound, LogIn, ShieldCheck, ShoppingBag, User } from 'lucide-react';
import type { ProfilePageProps } from '../types/theme';

export const ProfilePage = React.memo(function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  onNavigateToOrders,
  onNavigateToSettings,
  onNavigateToLogin,
}: ProfilePageProps) {
  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[720px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow-soft)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
            <User className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
            Sign in to view your order center.
          </h1>
          <p className="mx-auto mt-4 max-w-[32rem] text-sm leading-7 text-[var(--vault-copy)]">
            Logged-in buyers can manage recent purchases, review delivery history, and keep account details in one place.
          </p>
          <button
            onClick={onNavigateToLogin}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
          >
            <LogIn className="h-4 w-4" />
            Go to login
          </button>
        </div>
      </div>
    );
  }

  const initial = user.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1080px] space-y-6">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-[var(--vault-primary-soft)] text-2xl font-black text-[var(--vault-primary)]">
                {initial}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Account center
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                  {user.name}
                </h1>
                <p className="mt-2 text-sm text-[var(--vault-copy)]">{user.email}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={onNavigateToOrders}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
              >
                <ShoppingBag className="h-4 w-4" />
                View orders
              </button>
              <button
                onClick={onNavigateToSettings}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-5 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
              >
                <ShieldCheck className="h-4 w-4" />
                Account settings
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: ShoppingBag,
              title: 'Orders',
              description: 'Open recent purchases, payment state, and order-level delivery records.',
            },
            {
              icon: CreditCard,
              title: 'Digital delivery',
              description: 'Keep codes, accounts, and links attached to your order center after checkout.',
            },
            {
              icon: KeyRound,
              title: 'Guest recovery',
              description: 'Guest buyers can still reopen order access later with the checkout email and order reference.',
            },
            {
              icon: ShieldCheck,
              title: 'Security',
              description: 'Move sensitive delivery data into your own vault after claiming it.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-5 shadow-[var(--vault-shadow-soft)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-bold tracking-tight text-[var(--vault-ink)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">{description}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(18rem,0.65fr)]">
          <div className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
              Personal workspace
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
              Your storefront account is the control point for paid delivery.
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button
                onClick={onNavigateToOrders}
                className="rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4 text-left transition-colors hover:bg-[var(--vault-primary-soft)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                  Orders panel
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--vault-ink)]">Review purchases</p>
                <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                  Check payment status, delivery artifacts, and historical purchases.
                </p>
              </button>
              <button
                onClick={onNavigateToSettings}
                className="rounded-2xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4 text-left transition-colors hover:bg-[var(--vault-primary-soft)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">
                  Account settings
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--vault-ink)]">Profile and password</p>
                <p className="mt-2 text-sm leading-6 text-[var(--vault-copy)]">
                  Keep your contact details current and secure the account behind your purchases.
                </p>
              </button>
            </div>
          </div>

          <aside className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
              Account snapshot
            </p>
            <div className="mt-4 space-y-4 text-sm text-[var(--vault-copy)]">
              <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">Email</p>
                <p className="mt-2 font-medium text-[var(--vault-ink)]">{user.email}</p>
              </div>
              <div className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vault-copy-soft)]">Member since</p>
                <p className="mt-2 font-medium text-[var(--vault-ink)]">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
});

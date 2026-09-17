/**
 * User Profile Page Component — BOKMOO black & gold style
 */

import React from 'react';
import { MessageSquareText, ShoppingBag, UserRound } from 'lucide-react';
import type { ProfilePageProps } from 'shared/src/types/theme';

export const ProfilePage = React.memo(function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
}: ProfilePageProps) {
  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4">
        <div className="w-full max-w-md">
          <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
              <UserRound className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">Sign in to view your profile</h2>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
              Please log in to check your BOKMOO account
            </p>
            <button
              onClick={onNavigateToLogin}
              className="mt-8 h-12 w-full rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]"
              type="button"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--bokmoo-line)] border-t-[var(--bokmoo-gold)]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]">Loading profile...</p>
        </div>
      </div>
    );
  }

  const userInitial = user.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1080px]">
        {/* Profile header card */}
        <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[1.25rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] text-3xl font-bold text-[var(--bokmoo-bg)]">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-full w-full rounded-[1.25rem] object-cover"
                />
              ) : (
                userInitial
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <h1 className="text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">{user.name}</h1>
                <span className="inline-flex h-6 items-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                  Member
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)] sm:justify-start">
                <span>{user.email}</span>
                <span className="hidden sm:inline text-[var(--bokmoo-line-strong)]">·</span>
                <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Orders card */}
        <section className="mt-6 grid gap-6 lg:grid-cols-1">
          <div
            onClick={onNavigateToOrders}
            className="cursor-pointer rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] transition-colors sm:p-8"
          >
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Orders</p>
                  <h3 className="mt-1 text-lg font-bold tracking-tight text-[var(--bokmoo-ink)]">Order History</h3>
                  <p className="mt-1 text-sm text-[var(--bokmoo-copy)]">View and manage your orders</p>
                </div>
              </div>
              <button
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onNavigateToOrders();
                }}
                className="h-12 w-full rounded-full border border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-ink)] transition-colors hover:bg-[var(--bokmoo-bg-soft)] sm:w-auto"
                type="button"
              >
                View orders
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Account information card */}
            <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Account Information</h3>
              </div>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Email address</p>
                  <p className="mt-2 break-all text-sm font-bold text-[var(--bokmoo-ink)]">{user.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Member since</p>
                  <p className="mt-2 text-sm font-bold text-[var(--bokmoo-ink)]">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </section>

            {/* Account settings card */}
            <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Account Preferences</h3>
              </div>
              <div className="mt-5">
                <p className="text-sm leading-relaxed text-[var(--bokmoo-copy)]">
                  Update your name, phone, date of birth, language and timezone for your next BOKMOO trip.
                </p>
                <button
                  onClick={onNavigateToSettings}
                  className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]"
                  type="button"
                >
                  <UserRound className="h-4 w-4" />
                  Edit profile
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
});

export default ProfilePage;
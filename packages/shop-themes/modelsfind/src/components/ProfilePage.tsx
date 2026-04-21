import React from 'react';
import { LogIn, Settings2, ShoppingBag, UserRound } from 'lucide-react';
import type { ProfilePageProps } from 'shared/src/types/theme';

export const ProfilePage = React.memo(function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
}: ProfilePageProps) {
  if (isLoading) {
    return <div className="modelsfind-shell min-h-screen" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Private account</p>
          <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white">
            Sign in to view your profile.
          </h1>
          <p className="mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
            Profile and booking history stay behind the same refined access wall as the rest of the archive.
          </p>
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1560px]">
        <section className="modelsfind-frame modelsfind-noise overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]">
          <div className="p-4 md:p-6 xl:p-8">
            <section className="modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" />
              <div className="relative z-10 grid min-h-[22rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
                <div className="max-w-[40rem]">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">Private account</p>
                  <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white">
                    {user.name}
                  </h1>
                  <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                    Keep profile actions and order history aligned with the same premium editorial mood as the storefront.
                  </p>
                </div>
                <div className="modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                      {user.avatar ? <img src={user.avatar} alt={user.name} className="h-full w-full rounded-[1rem] object-cover" /> : <UserRound className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Member since</p>
                      <p className="[font-family:var(--modelsfind-display)] text-[1.8rem] leading-none tracking-[-0.04em] text-white">
                        {joinedDate}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-[var(--modelsfind-copy)]">{user.email}</p>
                </div>
              </div>
            </section>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <button
                type="button"
                onClick={onNavigateToOrders}
                className="group rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6 text-left transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Orders</p>
                <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                  Booking history
                </h2>
                <p className="mt-3 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                  Review current and past requests without dropping back to the default account-center styling.
                </p>
              </button>
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="group rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6 text-left transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                  <Settings2 className="h-5 w-5" />
                </div>
                <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Preferences</p>
                <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                  Settings
                </h2>
                <p className="mt-3 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                  Update profile details, language, timezone, and account security from a mobile-friendly settings surface.
                </p>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});


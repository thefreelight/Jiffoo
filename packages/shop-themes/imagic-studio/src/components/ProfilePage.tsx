'use client';

import { ArrowRight, FolderOpen, LockKeyhole, Settings2, Sparkles } from 'lucide-react';
import type { ProfilePageProps } from 'shared/src/types/theme';

import { StudioBadge, StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

export function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
}: ProfilePageProps) {
  if (isLoading) {
    return (
      <StudioPage activeNav="assets">
        <StudioMain className="space-y-6">
          <div className="h-56 animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 animate-pulse rounded-[1.8rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
            <div className="h-48 animate-pulse rounded-[1.8rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          </div>
        </StudioMain>
      </StudioPage>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <StudioPage activeNav="assets">
        <StudioMain>
          <StudioPanel className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Sign in to access your creator workspace.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--imagic-ink-soft)]">
              Your saved uploads, generation history, and account controls appear here once you authenticate.
            </p>
            <button type="button" onClick={onNavigateToLogin} className="imagic-button-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              Go to login
            </button>
          </StudioPanel>
        </StudioMain>
      </StudioPage>
    );
  }

  const initial = user.name?.charAt(0)?.toUpperCase() || 'C';

  return (
    <StudioPage activeNav="assets">
      <StudioMain className="space-y-6">
        <StudioPanel className="overflow-hidden p-0">
          <div className="h-28 bg-[radial-gradient(circle_at_left,color-mix(in_srgb,var(--imagic-primary)_26%,transparent),transparent_52%),linear-gradient(90deg,color-mix(in_srgb,var(--imagic-primary-strong)_18%,transparent),transparent)]" />
          <div className="flex flex-col gap-6 px-6 pb-6 pt-0 sm:px-8 sm:pb-8 lg:flex-row lg:items-end">
            <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-[1.6rem] border border-[color:var(--imagic-primary-border)] bg-[color:var(--imagic-surface-elevated)] text-3xl font-semibold text-[color:var(--imagic-primary)] shadow-[var(--imagic-soft-shadow)] sm:h-28 sm:w-28">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <StudioBadge>Creator profile</StudioBadge>
                <StudioBadge>Joined {new Date(user.createdAt).toLocaleDateString()}</StudioBadge>
              </div>
              <h1 className="mt-4 text-[clamp(2.3rem,4vw,4.2rem)] font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">{user.name}</h1>
              <p className="mt-2 text-base text-[color:var(--imagic-ink-soft)]">{user.email}</p>
            </div>
          </div>
        </StudioPanel>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <StudioPanel>
            <StudioSectionIntro
              eyebrow="Workspace overview"
              title="Keep your prompts, saved assets, and checkout history connected."
              body="This page is the operator view of the imagic experience: one place to jump back into settings, previous orders, and the visual system you are building."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <button type="button" onClick={onNavigateToOrders} className="rounded-[1.5rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] p-5 text-left transition hover:-translate-y-1">
                <FolderOpen className="h-6 w-6 text-[color:var(--imagic-primary)]" />
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Orders</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">Review purchases, creator packs, and any products that fed into your current studio workflow.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--imagic-primary)]">Open orders <ArrowRight className="h-4 w-4" /></span>
              </button>

              <button type="button" onClick={onNavigateToSettings} className="rounded-[1.5rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] p-5 text-left transition hover:-translate-y-1">
                <Settings2 className="h-6 w-6 text-[color:var(--imagic-primary)]" />
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Settings</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">Update profile details, tune account settings, and keep your creator workspace aligned.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--imagic-primary)]">Open settings <ArrowRight className="h-4 w-4" /></span>
              </button>
            </div>
          </StudioPanel>

          <StudioPanel>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">Creator signals</p>
            <div className="mt-4 grid gap-3">
              {[
                ['Workspace status', 'Active'],
                ['Saved prompt lanes', 'Image + Video'],
                ['Recommended move', 'Return to Generate'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--imagic-muted)]">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--imagic-ink)]">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-[color:var(--imagic-primary-border)] bg-[color:var(--imagic-primary-soft)]/30 px-4 py-4 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">
              Ready for the next sprint? Head back to the generate page and keep the same visual language flowing through prompts, products, and account space.
            </div>
          </StudioPanel>
        </div>
      </StudioMain>
    </StudioPage>
  );
}

'use client';

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import type { RegisterPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

export function RegisterPage({ isLoading, error, onSubmit, onOAuthClick, onNavigateToLogin }: RegisterPageProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = useMemo(
    () => formData.password.length === 0 || formData.password === formData.confirmPassword,
    [formData.confirmPassword, formData.password],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!passwordsMatch) {
      return;
    }
    const emailPrefix = formData.email.split('@')[0] || 'creator';
    const displayParts = emailPrefix.replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);

    await onSubmit({
      ...formData,
      firstName: displayParts[0] || 'Creator',
      lastName: displayParts.slice(1).join(' ') || 'Studio',
    });
  }

  return (
    <StudioPage activeNav="assets">
      <StudioMain>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_32rem]">
          <StudioPanel>
            <StudioSectionIntro
              eyebrow="Create account"
              title="Set up your imagic workspace for saved prompts, private assets, and repeat creative sprints."
              body="One account keeps generations, uploads, and creator-side product browsing connected. That means less friction between idea capture, prompt refinement, and final export."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ['Saved uploads', 'Keep reference images and reusable files ready for the next pass.'],
                ['Private history', 'Track what worked across campaigns, reels, and visual experiments.'],
                ['Creator identity', 'Build one home for your prompts, products, and export-ready assets.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-[1.4rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] p-4">
                  <Sparkles className="h-5 w-5 text-[color:var(--imagic-primary)]" />
                  <p className="mt-4 text-sm font-semibold text-[color:var(--imagic-ink)]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--imagic-ink-soft)]">{body}</p>
                </div>
              ))}
            </div>
          </StudioPanel>

          <form onSubmit={handleSubmit} className="rounded-[1.9rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/92 p-6 shadow-[var(--imagic-soft-shadow)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">Register</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Create your workspace.</h2>
            <p className="mt-2 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">Use an email you can return to when your next batch of prompts is ready.</p>

            {error ? (
              <div className="mt-5 rounded-[1.2rem] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>
            ) : null}

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--imagic-muted)]" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    placeholder="creator@studio.com"
                    className="h-12 w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] pl-11 pr-4 text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-[color:var(--imagic-muted)]"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Password</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--imagic-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] pl-11 pr-11 text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-[color:var(--imagic-muted)]"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--imagic-muted)]">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Confirm password</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--imagic-muted)]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(event) => setFormData((current) => ({ ...current, confirmPassword: event.target.value }))}
                    placeholder="••••••••"
                    className={`h-12 w-full rounded-[1rem] border bg-[color:var(--imagic-surface-elevated)] pl-11 pr-11 text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-[color:var(--imagic-muted)] ${passwordsMatch ? 'border-[color:var(--imagic-line)]' : 'border-rose-400/40'}`}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--imagic-muted)]">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!passwordsMatch ? <p className="mt-2 text-xs text-rose-300">Passwords do not match.</p> : null}
              </label>
            </div>

            <button type="submit" disabled={isLoading || !passwordsMatch} className="imagic-button-primary mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)] disabled:opacity-60">
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>

            <button type="button" onClick={() => void onOAuthClick('google')} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-5 text-sm font-medium text-[color:var(--imagic-ink)] transition hover:-translate-y-0.5">
              Continue with Google
            </button>

            <div className="mt-6 text-center text-sm text-[color:var(--imagic-ink-soft)]">
              Already have an account?{' '}
              <button type="button" onClick={onNavigateToLogin} className="text-[color:var(--imagic-primary)] transition hover:text-[color:var(--imagic-ink)]">
                Log in
              </button>
            </div>
          </form>
        </div>
      </StudioMain>
    </StudioPage>
  );
}

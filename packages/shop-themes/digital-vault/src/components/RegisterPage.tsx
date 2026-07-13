import React from 'react';
import { ArrowRight, UserPlus } from 'lucide-react';
import type { RegisterPageProps } from '../types/theme';

export const RegisterPage = React.memo(function RegisterPage({
  isLoading,
  error,
  onSubmit,
  onOAuthClick,
  onNavigateToLogin,
}: RegisterPageProps) {
  const [form, setForm] = React.useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(form);
  };

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[560px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-8 shadow-[var(--vault-shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Register</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
              Create a buyer account.
            </h1>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={form.firstName}
              onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              placeholder="First name"
              className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
            />
            <input
              value={form.lastName}
              onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              placeholder="Last name"
              className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
            />
          </div>

          <input
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email"
            className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Password"
            className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
          />
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            placeholder="Confirm password"
            className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
          />

          {error ? <p className="text-sm text-[var(--vault-danger)]">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" />
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => onOAuthClick('google')}
            className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-2.5 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
          >
            Continue with Google
          </button>
        </div>

        <button
          onClick={onNavigateToLogin}
          className="mt-6 text-sm font-medium text-[var(--vault-copy)] underline underline-offset-4"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
});

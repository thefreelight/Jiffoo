import React from 'react';
import { ArrowRight, LogIn } from 'lucide-react';
import type { LoginPageProps } from '../types/theme';

export const LoginPage = React.memo(function LoginPage({
  isLoading,
  error,
  onSubmit,
  onOAuthClick,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}: LoginPageProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[520px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-8 shadow-[var(--vault-shadow-soft)]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Login</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
              Sign in to your account center.
            </h1>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
          />

          {error ? <p className="text-sm text-[var(--vault-danger)]">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" />
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => onOAuthClick('google')}
            className="rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 py-2.5 text-sm font-medium text-[var(--vault-ink)] transition-colors hover:bg-[var(--vault-primary-soft)]"
          >
            Continue with Google
          </button>
          <button
            onClick={onNavigateToForgotPassword}
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--vault-primary)] underline underline-offset-4"
          >
            Forgot password
          </button>
        </div>

        <button
          onClick={onNavigateToRegister}
          className="mt-6 text-sm font-medium text-[var(--vault-copy)] underline underline-offset-4"
        >
          Create an account
        </button>
      </div>
    </div>
  );
});

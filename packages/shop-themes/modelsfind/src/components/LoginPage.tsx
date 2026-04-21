import React from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import type { LoginPageProps } from 'shared/src/types/theme';
import { resolveModelsfindSiteConfig } from '../site';

export const LoginPage = React.memo(function LoginPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}: LoginPageProps) {
  const site = resolveModelsfindSiteConfig(config);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const canSubmit = Boolean(email.trim() && password);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit(email.trim(), password);
  };

  return (
    <div className="modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1120px]">
        <section className="modelsfind-frame modelsfind-noise overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(24rem,0.76fr)]">
            <div className="modelsfind-hero overflow-hidden border-b border-[var(--modelsfind-line)] lg:border-b-0 lg:border-r">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" />
              <div className="relative z-10 flex min-h-[24rem] flex-col justify-end px-6 pb-8 pt-12 md:px-10 md:pb-10">
                <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">Private access</p>
                <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.9rem,7vw,5.2rem)] leading-[0.92] tracking-[-0.05em] text-white">
                  Enter the {site.brandName} archive.
                </h1>
                <p className="mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                  Sign in for booking requests, shortlist history, and concierge sessions across desktop and mobile.
                </p>
              </div>
            </div>
            <div className="p-5 md:p-8">
              <div className="mx-auto max-w-[28rem]">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <Sparkles className="h-4 w-4" />
                  Authentication
                </div>
                <h2 className="mt-3 [font-family:var(--modelsfind-display)] text-[2.4rem] leading-none tracking-[-0.04em] text-white">
                  Welcome back
                </h2>
                {error ? (
                  <div className="mt-5 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}
                <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Email</span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                        disabled={isLoading}
                      />
                    </div>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Password</span>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        className="modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-12 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <button
                    type="submit"
                    disabled={isLoading || !canSubmit}
                    className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60"
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
                <div className="mt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => onOAuthClick('google')}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
                  >
                    Continue with Google
                  </button>
                  <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                    <button type="button" onClick={onNavigateToForgotPassword} className="transition-colors hover:text-[var(--modelsfind-ink)]">
                      Forgot password
                    </button>
                    <button type="button" onClick={onNavigateToRegister} className="transition-colors hover:text-[var(--modelsfind-primary)]">
                      Create account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

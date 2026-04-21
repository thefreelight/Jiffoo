import React from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';
import type { RegisterPageProps } from 'shared/src/types/theme';
import { resolveModelsfindSiteConfig } from '../site';

export const RegisterPage = React.memo(function RegisterPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onNavigateToLogin,
}: RegisterPageProps) {
  const site = resolveModelsfindSiteConfig(config);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const passwordsMatch = !formData.confirmPassword || formData.password === formData.confirmPassword;
  const canSubmit =
    Boolean(
      formData.firstName.trim() &&
        formData.lastName.trim() &&
        formData.email.trim() &&
        formData.password &&
        formData.confirmPassword
    ) &&
    passwordsMatch &&
    acceptTerms;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      ...formData,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
    });
  };

  return (
    <div className="modelsfind-shell min-h-screen px-4 py-12 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1120px]">
        <section className="modelsfind-frame modelsfind-noise overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.84fr)]">
            <div className="modelsfind-hero overflow-hidden border-b border-[var(--modelsfind-line)] lg:border-b-0 lg:border-r">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" />
              <div className="relative z-10 flex min-h-[24rem] flex-col justify-end px-6 pb-8 pt-12 md:px-10 md:pb-10">
                <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">Membership</p>
                <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.9rem,7vw,5.2rem)] leading-[0.92] tracking-[-0.05em] text-white">
                  Request a private {site.brandName} account.
                </h1>
                <p className="mt-4 max-w-[32rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                  Registration should feel like a premium entry point, with minimal noise and mobile-first clarity.
                </p>
              </div>
            </div>
            <div className="p-5 md:p-8">
              <div className="mx-auto max-w-[30rem]">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <Sparkles className="h-4 w-4" />
                  New account
                </div>
                <h2 className="mt-3 [font-family:var(--modelsfind-display)] text-[2.4rem] leading-none tracking-[-0.04em] text-white">
                  Create your access
                </h2>
                {error ? (
                  <div className="mt-5 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}
                <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['firstName', 'First name', 'Ava'],
                      ['lastName', 'Last name', 'Noir'],
                    ].map(([key, label, placeholder]) => (
                      <label key={key} className="grid gap-2">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{label}</span>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
                          <input
                            type="text"
                            value={formData[key as 'firstName' | 'lastName']}
                            onChange={(event) => setFormData((prev) => ({ ...prev, [key]: event.target.value }))}
                            placeholder={placeholder}
                            className="modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-4 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                            disabled={isLoading}
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Email</span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
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
                        value={formData.password}
                        onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
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
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Confirm password</span>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--modelsfind-copy-soft)]" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(event) => setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                        placeholder="••••••••"
                        className="modelsfind-field h-12 w-full rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] pl-11 pr-12 text-sm text-[var(--modelsfind-ink)] placeholder:text-[var(--modelsfind-copy-soft)]"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-ink)]"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  {!passwordsMatch ? <p className="text-xs text-red-300">Passwords do not match.</p> : null}
                  <label className="flex items-start gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--modelsfind-copy)]">
                    <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-1 h-4 w-4 rounded border-[var(--modelsfind-line)] bg-transparent" />
                    <span>I agree to the private access terms and archive usage policy.</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isLoading || !canSubmit}
                    className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60"
                  >
                    {isLoading ? 'Creating account...' : 'Create account'}
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
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] transition-colors hover:text-[var(--modelsfind-primary)]"
                  >
                    Already have access? Sign in
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

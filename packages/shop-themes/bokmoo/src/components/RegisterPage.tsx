import React from 'react';
import { Apple, Chrome, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import type { RegisterPageProps } from 'shared/src/types/theme';
import { resolveBokmooSiteConfig } from '../site';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

export function RegisterPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onAppleOAuthClick,
  socialAuthStatus,
  onNavigateToLogin,
}: RegisterPageProps) {
  const site = resolveBokmooSiteConfig(config);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const passwordsMatch = formData.password === formData.confirmPassword;
  const socialAuthLoading = socialAuthStatus?.isLoading === true;
  const googleAvailable = socialAuthStatus ? socialAuthStatus.google === true : true;
  const appleAvailable = socialAuthStatus ? socialAuthStatus.apple === true : Boolean(onAppleOAuthClick);
  const canSubmit =
    formData.firstName &&
    formData.lastName &&
    formData.email &&
    formData.password &&
    formData.confirmPassword &&
    passwordsMatch;

  const updateField = (field: keyof typeof formData) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => setFormData((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit(formData);
  };

  const inputClassName =
    `h-13 w-full rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_25%),radial-gradient(circle_at_12%_76%,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_26%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_86%,black))]" />
        <div className="absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(24rem,0.68fr)]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)]">
            <ShieldCheck className="h-4 w-4" />
            Protected traveler identity
          </div>
          <h1 className="mt-7 max-w-3xl text-[clamp(3.4rem,7vw,6.1rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--bokmoo-ink)]">
            Create the account your eSIMs follow.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--bokmoo-copy)]">
            Keep orders, activation codes, profile history, and support cases attached to one BOKMOO identity.
          </p>
        </section>

        <section className="mx-auto w-full max-w-[32rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7">
          <div className="rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]">
              {site.brandName.toUpperCase()} account
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]">
              Create account
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">
              Start with a secure profile for purchases and global activation support.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onOAuthClick('google')}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading || socialAuthLoading || !googleAvailable}
                title={googleAvailable ? 'Google' : 'Google sign-in is unavailable'}
              >
                <Chrome className="h-4 w-4" />
                Google
              </button>
              <button
                type="button"
                onClick={() => onAppleOAuthClick?.()}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading || socialAuthLoading || !appleAvailable || !onAppleOAuthClick}
                title={appleAvailable ? 'Apple' : 'Apple sign-in is unavailable'}
              >
                <Apple className="h-4 w-4" />
                Apple
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--bokmoo-line)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]">
                or email
              </span>
              <div className="h-px flex-1 bg-[var(--bokmoo-line)]" />
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {error ? (
                <div className="rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_12%,transparent)] p-4 text-sm leading-6 text-[var(--bokmoo-ink)]">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                {(['firstName', 'lastName'] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                      {field === 'firstName' ? 'First name' : 'Last name'}
                    </span>
                    <span className="relative mt-2 block">
                      <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                      <input
                        type="text"
                        value={formData[field]}
                        onChange={updateField(field)}
                        placeholder={field === 'firstName' ? 'Ada' : 'Lovelace'}
                        className={inputClassName}
                        disabled={isLoading}
                        autoComplete={field === 'firstName' ? 'given-name' : 'family-name'}
                      />
                    </span>
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Email
                </span>
                <span className="relative mt-2 block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={updateField('email')}
                    placeholder="you@example.com"
                    className={inputClassName}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                    Password
                  </span>
                  <span className="relative mt-2 block">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={updateField('password')}
                      placeholder="........"
                      className={`${inputClassName} pr-12`}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
                      disabled={isLoading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                    Confirm
                  </span>
                  <span className="relative mt-2 block">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={updateField('confirmPassword')}
                      placeholder="........"
                      className={`${inputClassName} pr-12 ${formData.confirmPassword && !passwordsMatch ? 'border-[var(--bokmoo-danger)]' : ''}`}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
                      disabled={isLoading}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                  {formData.confirmPassword && !passwordsMatch ? (
                    <span className="mt-2 block text-xs text-[var(--bokmoo-danger)]">Passwords do not match</span>
                  ) : null}
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !canSubmit}
                className={`inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-[var(--bokmoo-line)] pt-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                Already have an account?
              </p>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className={`mt-3 text-sm font-semibold text-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold-strong)] ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading}
              >
                Sign in
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

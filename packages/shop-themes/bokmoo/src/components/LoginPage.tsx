import React from 'react';
import { Apple, Chrome, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import type { LoginPageProps } from 'shared/src/types/theme';
import { resolveBokmooSiteConfig } from '../site';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

export function LoginPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onAppleOAuthClick,
  socialAuthStatus,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}: LoginPageProps) {
  const site = resolveBokmooSiteConfig(config);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const socialAuthLoading = socialAuthStatus?.isLoading === true;
  const googleAvailable = socialAuthStatus ? socialAuthStatus.google === true : true;
  const appleAvailable = socialAuthStatus ? socialAuthStatus.apple === true : Boolean(onAppleOAuthClick);

  const handleAutofill = (setter: (value: string) => void) => (
    event: React.AnimationEvent<HTMLInputElement>,
  ) => {
    if (event.animationName === 'onAutoFillStart') {
      setter(event.currentTarget.value);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const emailValue = emailRef.current?.value || email;
    const passwordValue = passwordRef.current?.value || password;
    if (!emailValue || !passwordValue) return;
    await onSubmit(emailValue, passwordValue);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_24%),radial-gradient(circle_at_16%_78%,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_24%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_86%,black))]" />
        <div className="absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.62fr)]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)]">
            <ShieldCheck className="h-4 w-4" />
            Secure account access
          </div>
          <h1 className="mt-7 max-w-3xl text-[clamp(3.5rem,7vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--bokmoo-ink)]">
            Sign in before your next border.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--bokmoo-copy)]">
            Manage BOKMOO eSIM profiles, orders, and activation details from the same black-and-gold travel control surface.
          </p>
          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ['Orders', 'Track purchases'],
              ['Profiles', 'Manage eSIMs'],
              ['Support', 'Get help fast'],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-[1.15rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.07_0.008_75_/_0.76)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
              >
                <p className="text-sm font-semibold text-[var(--bokmoo-gold)]">{title}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--bokmoo-copy-soft)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7">
          <div className="rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]">
                {site.brandName.toUpperCase()} account
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                Welcome back
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">
                Continue to your orders, profiles, and activation workspace.
              </p>
            </div>

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

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Email
                </span>
                <span className="relative mt-2 block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onAnimationStart={handleAutofill(setEmail)}
                    placeholder="you@example.com"
                    className={`h-13 w-full rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Password
                </span>
                <span className="relative mt-2 block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onAnimationStart={handleAutofill(setPassword)}
                    placeholder="••••••••"
                    className={`h-13 w-full rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] py-3 pl-11 pr-12 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    autoComplete="current-password"
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

              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={onNavigateToForgotPassword}
                  className={`text-sm font-medium text-[var(--bokmoo-copy)] underline decoration-[var(--bokmoo-line)] underline-offset-4 hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
                  disabled={isLoading}
                >
                  Forgot password
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-[var(--bokmoo-line)] pt-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                New to {site.brandName.toUpperCase()}?
              </p>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className={`mt-3 text-sm font-semibold text-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold-strong)] ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading}
              >
                Create account
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

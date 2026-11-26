import React from 'react';
import { KeyRound, Loader2, Mail } from 'lucide-react';
import type { ForgotPasswordPageProps } from 'shared/src/types/theme';
import { AUTH, accountLabel, authBrand, authErrorText, authText, pageLocale, type AuthCopy } from '../lib/auth-copy';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

const INPUT_CLASS =
  'h-12 w-full rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_34%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_62%,#1a1720)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[color:color-mix(in_oklab,var(--bokmoo-copy)_80%,transparent)] transition-colors focus:border-[var(--bokmoo-gold)]';
const PRIMARY_BUTTON =
  'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]';
const TEXT_BUTTON =
  'font-medium text-[var(--bokmoo-copy)] underline decoration-[var(--bokmoo-line)] underline-offset-4 hover:text-[var(--bokmoo-gold)] disabled:opacity-60';

const messageOf = (cause: unknown): string => (cause instanceof Error && cause.message ? cause.message : String(cause || ''));

/**
 * Password reset in the theme's own words. The storefront used to fall back to a built-in form written
 * in English only: the email, the six-digit code, the new password, then back to sign-in.
 */
export function ForgotPasswordPage({
  isLoading,
  error,
  config,
  locale,
  initialEmail,
  onRequestCode,
  onResetPassword,
  onNavigateToLogin,
}: ForgotPasswordPageProps) {
  const brand = authBrand(config);
  const language = pageLocale(locale);
  const say = (copy: AuthCopy) => authText(language, copy);
  const [step, setStep] = React.useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = React.useState(String(initialEmail || '').trim());
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [failure, setFailure] = React.useState('');

  const sendCode = async () => {
    if (!email || isLoading) return;
    setFailure('');
    try {
      await onRequestCode(email);
      setStep('code');
    } catch (cause) {
      setFailure(messageOf(cause));
    }
  };

  const submitNewPassword = async () => {
    if (!code || !password || isLoading) return;
    setFailure('');
    try {
      await onResetPassword({ email, code, password });
      setStep('done');
    } catch (cause) {
      setFailure(messageOf(cause));
    }
  };

  const errorText = authErrorText(language, failure || error);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_26%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_86%,black))]" />
        <div className="absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" />
      </div>

      <section
        className="relative w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7"
        data-purpose="forgot-password"
        data-step={step}
      >
        <div className="rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]">{accountLabel(language, brand)}</p>
          <h1 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]">
            {say(step === 'done' ? AUTH.resetDoneTitle : AUTH.resetTitle)}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">
            {step === 'done'
              ? say(AUTH.resetDoneLead)
              : step === 'code'
                ? authText(language, AUTH.resetSentTo).replace('{email}', email)
                : say(AUTH.resetLead)}
          </p>

          {errorText ? (
            <div
              className="mt-5 rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_12%,transparent)] p-4 text-sm leading-6 text-[var(--bokmoo-ink)]"
              role="alert"
              data-purpose="auth-error"
            >
              {errorText}
            </div>
          ) : null}

          {step === 'email' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendCode();
              }}
              className="mt-6 space-y-5"
              data-purpose="forgot-password-email"
            >
              <label className="block">
                <span className={LABEL}>{say(AUTH.email)}</span>
                <span className="relative mt-2 block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className={`${INPUT_CLASS} ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    autoComplete="email"
                    required
                  />
                </span>
              </label>
              <button type="submit" disabled={isLoading || !email} className={`${PRIMARY_BUTTON} ${FOCUS_VISIBLE_RING}`}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {say(AUTH.sending)}
                  </>
                ) : (
                  say(AUTH.sendCode)
                )}
              </button>
            </form>
          ) : null}

          {step === 'code' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitNewPassword();
              }}
              className="mt-6 space-y-5"
              data-purpose="forgot-password-code"
            >
              <label className="block">
                <span className={LABEL}>{say(AUTH.code)}</span>
                <span className="relative mt-2 block">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className={`${INPUT_CLASS} bokmoo-code-input ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    required
                  />
                </span>
              </label>
              <label className="block">
                <span className={LABEL}>{say(AUTH.newPassword)}</span>
                <span className="relative mt-2 block">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className={`${INPUT_CLASS} ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </span>
              </label>
              <button type="submit" disabled={isLoading || !code || !password} className={`${PRIMARY_BUTTON} ${FOCUS_VISIBLE_RING}`}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {say(AUTH.saving)}
                  </>
                ) : (
                  say(AUTH.setNewPassword)
                )}
              </button>
              <div className="flex items-center justify-between gap-4 text-sm">
                <button type="button" disabled={isLoading} onClick={() => void sendCode()} className={`${TEXT_BUTTON} ${FOCUS_VISIBLE_RING}`}>
                  {say(AUTH.resend)}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setFailure('');
                    setStep('email');
                  }}
                  className={`${TEXT_BUTTON} ${FOCUS_VISIBLE_RING}`}
                >
                  {say(AUTH.changeEmail)}
                </button>
              </div>
            </form>
          ) : null}

          {step === 'done' ? (
            <button type="button" onClick={onNavigateToLogin} className={`mt-6 ${PRIMARY_BUTTON} ${FOCUS_VISIBLE_RING}`}>
              {say(AUTH.signIn)}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

import React from 'react';
import { Apple, Chrome, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import type { LoginPageProps } from 'shared/src/types/theme';
import { type ThemeCopy, pickCopy, resolveEsimSiteConfig } from '../site';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--esim-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--esim-bg)]';

export function LoginPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onAppleOAuthClick,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  locale,
}: LoginPageProps) {
  const site = resolveEsimSiteConfig(config, locale);
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
  const accountLabel = pickCopy(locale, {
    en: `${site.brandName.toUpperCase()} account`,
    hans: `${site.brandName.toUpperCase()} 账户`,
    hant: `${site.brandName.toUpperCase()} 帳戶`,
    ja: `${site.brandName.toUpperCase()} アカウント`,
    ko: `${site.brandName.toUpperCase()} 계정`,
    fr: `Compte ${site.brandName.toUpperCase()}`,
    de: `${site.brandName.toUpperCase()}-Konto`,
  });
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

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
    <div className="relative min-h-screen overflow-hidden bg-[var(--esim-bg)] px-4 py-12 text-[var(--esim-ink)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,color-mix(in_oklab,var(--esim-gold)_18%,transparent),transparent_24%),radial-gradient(circle_at_16%_78%,color-mix(in_oklab,var(--esim-gold)_8%,transparent),transparent_24%),linear-gradient(180deg,var(--esim-bg),color-mix(in_oklab,var(--esim-bg)_86%,black))]" />
        <div className="absolute inset-0 opacity-40 [background-image:var(--esim-grid)] [background-size:72px_72px]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.62fr)]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--esim-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--esim-gold)]">
            <ShieldCheck className="h-4 w-4" />
            {t({ en: 'Secure account access', hans: '安全访问账户', hant: '安全存取帳戶' })}
          </div>
          <h1 className="mt-7 max-w-3xl text-[clamp(3.5rem,7vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--esim-ink)]">
            {t({ en: 'Sign in before your next border.', hans: '下次出境前，先登录账户。', hant: '下次出境前，先登入帳戶。' })}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--esim-copy)]">
            {t({
              en: 'Manage BOKMOO eSIM profiles, orders, and activation details from the same black-and-gold travel control surface.',
              hans: '在同一个黑金旅行控制台里管理 BOKMOO eSIM 配置文件、订单和激活详情。',
              hant: '在同一個黑金旅行控制台裡管理 BOKMOO eSIM 設定檔、訂單和啟用詳情。',
            })}
          </p>
          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              [t({ en: 'Orders', hans: '订单', hant: '訂單' }), t({ en: 'Track purchases', hans: '跟踪购买记录', hant: '追蹤購買紀錄' })],
              [t({ en: 'Profiles', hans: 'eSIM 配置', hant: 'eSIM 設定檔' }), t({ en: 'Manage eSIMs', hans: '管理 eSIM', hant: '管理 eSIM' })],
              [t({ en: 'Support', hans: '支持', hant: '支援' }), t({ en: 'Get help fast', hans: '快速获得帮助', hant: '快速獲得協助' })],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-[1.15rem] border border-[var(--esim-line)] bg-[color:oklch(0.07_0.008_75_/_0.76)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
              >
                <p className="text-sm font-semibold text-[var(--esim-gold)]">{title}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--esim-copy-soft)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--esim-bg-elevated)_94%,white),var(--esim-bg-elevated))] p-5 shadow-[var(--esim-shadow)] sm:p-7">
          <div className="rounded-[1.1rem] border border-[var(--esim-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--esim-gold)]">
                {accountLabel}
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--esim-ink)]">
                {t({ en: 'Welcome back', hans: '欢迎回来', hant: '歡迎回來' })}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--esim-copy)]">
                {t({ en: 'Continue to your orders, profiles, and activation workspace.', hans: '继续前往您的订单、eSIM 配置和激活工作台。', hant: '繼續前往您的訂單、eSIM 設定檔和啟用工作台。' })}
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onOAuthClick('google')}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--esim-ink)] transition-colors hover:border-[var(--esim-gold)] hover:text-[var(--esim-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading}
              >
                <Chrome className="h-4 w-4" />
                Google
              </button>
              <button
                type="button"
                onClick={() => onAppleOAuthClick?.()}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--esim-ink)] transition-colors hover:border-[var(--esim-gold)] hover:text-[var(--esim-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading || !onAppleOAuthClick}
              >
                <Apple className="h-4 w-4" />
                Apple
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--esim-line)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--esim-copy-soft)]">
                {t({ en: 'or email', hans: '或使用邮箱', hant: '或使用電子郵件' })}
              </span>
              <div className="h-px flex-1 bg-[var(--esim-line)]" />
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {error ? (
                <div className="rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--esim-danger)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-danger)_12%,transparent)] p-4 text-sm leading-6 text-[var(--esim-ink)]">
                  {error}
                </div>
              ) : null}

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                  {t({ en: 'Email', hans: '邮箱', hant: '電子郵件' })}
                </span>
                <span className="relative mt-2 block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" />
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onAnimationStart={handleAutofill(setEmail)}
                    placeholder="you@example.com"
                    className={`h-12 w-full rounded-[1rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_34%,var(--esim-line))] bg-[color:color-mix(in_oklab,var(--esim-bg)_62%,#1a1720)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--esim-ink)] outline-none placeholder:text-[color:color-mix(in_oklab,var(--esim-copy)_80%,transparent)] transition-colors focus:border-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                  {t({ en: 'Password', hans: '密码', hant: '密碼' })}
                </span>
                <span className="relative mt-2 block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" />
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onAnimationStart={handleAutofill(setPassword)}
                    placeholder="••••••••"
                    className={`h-12 w-full rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] py-3 pl-11 pr-12 text-sm font-medium text-[var(--esim-ink)] outline-none placeholder:text-[var(--esim-copy-soft)] transition-colors focus:border-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--esim-copy-soft)] hover:text-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                    disabled={isLoading}
                    aria-label={showPassword ? t({ en: 'Hide password', hans: '隐藏密码', hant: '隱藏密碼' }) : t({ en: 'Show password', hans: '显示密码', hant: '顯示密碼' })}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={onNavigateToForgotPassword}
                  className={`text-sm font-medium text-[var(--esim-copy)] underline decoration-[var(--esim-line)] underline-offset-4 hover:text-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                  disabled={isLoading}
                >
                  {t({ en: 'Forgot password', hans: '忘记密码', hant: '忘記密碼' })}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_88%,white),color-mix(in_oklab,var(--esim-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--esim-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--esim-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t({ en: 'Signing in', hans: '登录中…', hant: '登入中…' })}
                  </>
                ) : (
                  t({ en: 'Sign in', hans: '登录', hant: '登入' })
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-[var(--esim-line)] pt-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                {pickCopy(locale, {
                  en: `New to ${site.brandName.toUpperCase()}?`,
                  hans: `还没有 ${site.brandName.toUpperCase()} 账户？`,
                  hant: `還沒有 ${site.brandName.toUpperCase()} 帳戶？`,
                  ja: `${site.brandName.toUpperCase()} を初めてご利用ですか？`,
                  ko: `${site.brandName.toUpperCase()}이(가) 처음이신가요?`,
                  fr: `Nouveau sur ${site.brandName.toUpperCase()} ?`,
                  de: `Neu bei ${site.brandName.toUpperCase()}?`,
                })}
              </p>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className={`mt-3 text-sm font-semibold text-[var(--esim-gold)] hover:text-[var(--esim-gold-strong)] ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading}
              >
                {t({ en: 'Create account', hans: '创建账户', hant: '建立帳戶' })}
              </button>
              {typeof window !== 'undefined' && window.location.hostname.split('.').filter(Boolean).length > 2 ? (
                <>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[var(--esim-line)]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--esim-copy-soft)]">
                      {t({ en: 'already with us', hans: '已有账户', hant: '已有帳戶' })}
                    </span>
                    <div className="h-px flex-1 bg-[var(--esim-line)]" />
                  </div>
                  <a
                    href={`https://bokmoo.com/auth-sync?back=${encodeURIComponent(window.location.origin + window.location.pathname)}`}
                    className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[0.95rem] border border-[var(--esim-line)] px-4 text-sm font-medium text-[var(--esim-copy)] transition-colors hover:border-[var(--esim-gold)] hover:text-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                  >
                    {pickCopy(locale, {
                      en: `Use your ${site.brandName} session to sign in`,
                      hans: `使用 ${site.brandName} 账户会话登录`,
                      hant: `使用 ${site.brandName} 帳戶工作階段登入`,
                      ja: `${site.brandName} のセッションでログイン`,
                      ko: `${site.brandName} 세션으로 로그인`,
                      fr: `Utilisez votre session ${site.brandName} pour vous connecter`,
                      de: `Mit Ihrer ${site.brandName}-Sitzung anmelden`,
                    })}
                  </a>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

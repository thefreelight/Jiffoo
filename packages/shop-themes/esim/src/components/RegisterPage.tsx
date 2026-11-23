import React from 'react';
import { Apple, Chrome, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import type { RegisterPageProps } from 'shared/src/types/theme';
import { pickCopy, resolveEsimSiteConfig, type ThemeCopy } from '../site';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--esim-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--esim-bg)]';

export function RegisterPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onAppleOAuthClick,
  onNavigateToLogin,
  locale,
}: RegisterPageProps) {
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
  const site = resolveEsimSiteConfig(config, locale);
  const accountLabel = pickCopy(locale, {
    en: `${site.brandName.toUpperCase()} account`,
    hans: `${site.brandName.toUpperCase()} 账户`,
    hant: `${site.brandName.toUpperCase()} 帳戶`,
    ja: `${site.brandName.toUpperCase()} アカウント`,
    ko: `${site.brandName.toUpperCase()} 계정`,
    fr: `Compte ${site.brandName.toUpperCase()}`,
    de: `${site.brandName.toUpperCase()}-Konto`,
  });
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
    `h-12 w-full rounded-[1rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_34%,var(--esim-line))] bg-[color:color-mix(in_oklab,var(--esim-bg)_62%,#1a1720)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--esim-ink)] outline-none placeholder:text-[color:color-mix(in_oklab,var(--esim-copy)_80%,transparent)] transition-colors focus:border-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--esim-bg)] px-4 py-12 text-[var(--esim-ink)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,color-mix(in_oklab,var(--esim-gold)_18%,transparent),transparent_25%),radial-gradient(circle_at_12%_76%,color-mix(in_oklab,var(--esim-gold)_8%,transparent),transparent_26%),linear-gradient(180deg,var(--esim-bg),color-mix(in_oklab,var(--esim-bg)_86%,black))]" />
        <div className="absolute inset-0 opacity-40 [background-image:var(--esim-grid)] [background-size:72px_72px]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(24rem,0.68fr)]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--esim-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--esim-gold)]">
            <ShieldCheck className="h-4 w-4" />
            {t({ en: 'Protected traveler identity', hans: '受保护的旅行者身份', hant: '受保護的旅行者身分' })}
          </div>
          <h1 className="mt-7 max-w-3xl text-[clamp(3.4rem,7vw,6.1rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--esim-ink)]">
            {t({ en: 'Create the account your eSIMs follow.', hans: '创建一个账户，所有 eSIM 随行。', hant: '建立一個帳戶，所有 eSIM 隨行。' })}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--esim-copy)]">
            {t({
              en: 'Keep orders, activation codes, profile history, and support cases attached to one BOKMOO identity.',
              hans: '订单、激活码、配置文件历史和客服工单，都归属同一个 BOKMOO 身份。',
              hant: '訂單、啟用碼、設定檔歷史和客服工單，都歸屬同一個 BOKMOO 身分。',
            })}
          </p>
        </section>

        <section className="mx-auto w-full max-w-[32rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--esim-bg-elevated)_94%,white),var(--esim-bg-elevated))] p-5 shadow-[var(--esim-shadow)] sm:p-7">
          <div className="rounded-[1.1rem] border border-[var(--esim-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--esim-gold)]">
              {accountLabel}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--esim-ink)]">
              {t({ en: 'Create account', hans: '创建账户', hant: '建立帳戶' })}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--esim-copy)]">
              {t({ en: 'Start with a secure profile for purchases and global activation support.', hans: '先创建一份安全的资料，用于购买和全球激活支持。', hant: '先建立一份安全的資料，用於購買和全球啟用支援。' })}
            </p>

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

              <div className="grid gap-4 sm:grid-cols-2">
                {(['firstName', 'lastName'] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                      {field === 'firstName' ? t({ en: 'First name', hans: '名', hant: '名' }) : t({ en: 'Last name', hans: '姓', hant: '姓' })}
                    </span>
                    <span className="relative mt-2 block">
                      <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" />
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
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                  {t({ en: 'Email', hans: '邮箱', hant: '電子郵件' })}
                </span>
                <span className="relative mt-2 block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" />
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
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                    {t({ en: 'Password', hans: '密码', hant: '密碼' })}
                  </span>
                  <span className="relative mt-2 block">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" />
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
                      className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--esim-copy-soft)] hover:text-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                      disabled={isLoading}
                      aria-label={showPassword ? t({ en: 'Hide password', hans: '隐藏密码', hant: '隱藏密碼' }) : t({ en: 'Show password', hans: '显示密码', hant: '顯示密碼' })}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                    {t({ en: 'Confirm', hans: '确认密码', hant: '確認密碼' })}
                  </span>
                  <span className="relative mt-2 block">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={updateField('confirmPassword')}
                      placeholder="........"
                      className={`${inputClassName} pr-12 ${formData.confirmPassword && !passwordsMatch ? 'border-[var(--esim-danger)]' : ''}`}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className={`absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--esim-copy-soft)] hover:text-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
                      disabled={isLoading}
                      aria-label={showConfirmPassword ? t({ en: 'Hide password', hans: '隐藏密码', hant: '隱藏密碼' }) : t({ en: 'Show password', hans: '显示密码', hant: '顯示密碼' })}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                  {formData.confirmPassword && !passwordsMatch ? (
                    <span className="mt-2 block text-xs text-[var(--esim-danger)]">{t({ en: 'Passwords do not match', hans: '两次输入的密码不一致', hant: '兩次輸入的密碼不一致' })}</span>
                  ) : null}
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !canSubmit}
                className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_88%,white),color-mix(in_oklab,var(--esim-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--esim-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--esim-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t({ en: 'Creating', hans: '创建中…', hant: '建立中…' })}
                  </>
                ) : (
                  t({ en: 'Create account', hans: '创建账户', hant: '建立帳戶' })
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-[var(--esim-line)] pt-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
                {t({ en: 'Already have an account?', hans: '已有账户？', hant: '已有帳戶？' })}
              </p>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className={`mt-3 text-sm font-semibold text-[var(--esim-gold)] hover:text-[var(--esim-gold-strong)] ${FOCUS_VISIBLE_RING}`}
                disabled={isLoading}
              >
                {t({ en: 'Sign in', hans: '登录', hant: '登入' })}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

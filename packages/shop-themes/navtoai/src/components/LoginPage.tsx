import React from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import type { LoginPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { resolveNavToAiSiteConfig } from '../site';

function getLoginCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      eyebrow: '帳戶登入',
      title: '登入你的 NavtoAI 工作區。',
      body: '登入後可以管理收藏、提交訂閱、訂單紀錄與個人偏好設定。',
      email: '電子郵件',
      password: '密碼',
      forgot: '忘記密碼？',
      submit: '登入',
      submitting: '登入中...',
      google: '使用 Google 繼續',
      register: '建立帳戶',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      eyebrow: '账户登录',
      title: '登录你的 NavtoAI 工作区。',
      body: '登录后可以管理收藏、提交订阅、订单记录和个人偏好设置。',
      email: '邮箱',
      password: '密码',
      forgot: '忘记密码？',
      submit: '登录',
      submitting: '登录中...',
      google: '使用 Google 继续',
      register: '创建账户',
    };
  }

  return {
    eyebrow: 'Account login',
    title: 'Sign in to your NavtoAI workspace.',
    body: 'Once signed in, you can manage favorites, submissions, orders, and personal preferences.',
    email: 'Email',
    password: 'Password',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    submitting: 'Signing in...',
    google: 'Continue with Google',
    register: 'Create account',
  };
}

export const LoginPage = React.memo(function LoginPage({
  isLoading,
  error,
  locale,
  config,
  onSubmit,
  onOAuthClick,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}: LoginPageProps) {
  const content = getLoginCopy(locale);
  const site = resolveNavToAiSiteConfig(config, locale);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) return;
    await onSubmit(email.trim(), password);
  };

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="grid min-h-[78vh] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.92fr)] xl:items-stretch">
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,#0a1030_0%,#11163c_44%,#17103a_100%)] p-8 text-white shadow-[var(--navtoai-shadow-hero)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/76">
            <ShieldCheck className="h-4 w-4 text-[#8f86ff]" />
            {content.eyebrow}
          </div>
          <h1 className="mt-6 max-w-2xl text-[clamp(2.4rem,5vw,4.4rem)] font-black leading-[0.94] tracking-[-0.06em]">
            {content.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/76">{content.body}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [copyLine(locale, '收藏與帳戶管理', 'Favorites and account control')],
              [copyLine(locale, '付費提交與訂閱狀態', 'Paid submissions and plan status')],
              [copyLine(locale, `${site.brandName} 專屬工作區`, `${site.brandName} workspace access`)],
            ].map(([text]) => (
              <div key={text} className="rounded-[1rem] border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white/78">
                {text}
              </div>
            ))}
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8"
        >
          {error ? (
            <div className="mb-5 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.email}</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--navtoai-copy-soft)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] pl-11 pr-4 text-sm text-[var(--navtoai-ink)] outline-none"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.password}</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--navtoai-copy-soft)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] pl-11 pr-12 text-sm text-[var(--navtoai-ink)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--navtoai-copy-soft)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={onNavigateToForgotPassword}
            className="mt-4 text-sm font-medium text-[var(--navtoai-primary)]"
          >
            {content.forgot}
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white shadow-[var(--navtoai-glow)] disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {content.submitting}
              </>
            ) : (
              <>
                {content.submit}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void onOAuthClick('google')}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white px-5 text-sm font-semibold text-[var(--navtoai-ink)]"
          >
            {content.google}
          </button>

          <div className="mt-6 text-sm text-[var(--navtoai-copy)]">
            <button type="button" onClick={onNavigateToRegister} className="font-semibold text-[var(--navtoai-primary)]">
              {content.register}
            </button>
          </div>
        </form>
      </div>
    </MarketplaceFrame>
  );
});

function copyLine(locale: string | undefined, zh: string, en: string): string {
  const resolved = getNavCopy(locale).locale;
  return resolved === 'en' ? en : zh;
}


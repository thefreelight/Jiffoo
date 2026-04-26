import React from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, UserRound } from 'lucide-react';
import type { RegisterPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getRegisterCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      eyebrow: '建立帳戶',
      title: '建立你的 NavtoAI 帳戶。',
      body: '建立帳戶後，你可以管理專案提交、收藏、訂閱計畫與個人設定。',
      firstName: '名字',
      lastName: '姓氏',
      email: '電子郵件',
      password: '密碼',
      confirmPassword: '確認密碼',
      submit: '建立帳戶',
      submitting: '建立中...',
      google: '使用 Google 繼續',
      login: '已有帳戶？立即登入',
      mismatch: '兩次輸入的密碼不一致。',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      eyebrow: '创建账户',
      title: '创建你的 NavtoAI 账户。',
      body: '创建账户后，你可以管理项目提交、收藏、订阅计划和个人设置。',
      firstName: '名字',
      lastName: '姓氏',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      submit: '创建账户',
      submitting: '创建中...',
      google: '使用 Google 继续',
      login: '已有账户？立即登录',
      mismatch: '两次输入的密码不一致。',
    };
  }

  return {
    eyebrow: 'Create account',
    title: 'Create your NavtoAI account.',
    body: 'Once registered, you can manage project submissions, favorites, plans, and personal settings.',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    submit: 'Create account',
    submitting: 'Creating...',
    google: 'Continue with Google',
    login: 'Already have an account? Sign in',
    mismatch: 'Passwords do not match.',
  };
}

export const RegisterPage = React.memo(function RegisterPage({
  isLoading,
  error,
  locale,
  config,
  onSubmit,
  onOAuthClick,
  onNavigateToLogin,
}: RegisterPageProps) {
  const content = getRegisterCopy(locale);
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
  const canSubmit = Boolean(
    formData.firstName &&
      formData.lastName &&
      formData.email &&
      formData.password &&
      formData.confirmPassword &&
      passwordsMatch,
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit(formData);
  };

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="grid min-h-[78vh] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.92fr)] xl:items-stretch">
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,#0a1030_0%,#11163c_44%,#17103a_100%)] p-8 text-white shadow-[var(--navtoai-shadow-hero)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/76">
            <UserRound className="h-4 w-4 text-[#8f86ff]" />
            {content.eyebrow}
          </div>
          <h1 className="mt-6 max-w-2xl text-[clamp(2.4rem,5vw,4.4rem)] font-black leading-[0.94] tracking-[-0.06em]">
            {content.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/76">{content.body}</p>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldIconInput
              label={content.firstName}
              value={formData.firstName}
              onChange={(value) => setFormData((prev) => ({ ...prev, firstName: value }))}
              icon={<UserRound className="h-4 w-4" />}
            />
            <FieldIconInput
              label={content.lastName}
              value={formData.lastName}
              onChange={(value) => setFormData((prev) => ({ ...prev, lastName: value }))}
              icon={<UserRound className="h-4 w-4" />}
            />
          </div>

          <div className="mt-4 grid gap-4">
            <FieldIconInput
              label={content.email}
              value={formData.email}
              onChange={(value) => setFormData((prev) => ({ ...prev, email: value }))}
              icon={<Mail className="h-4 w-4" />}
              type="email"
            />
            <PasswordInput
              label={content.password}
              value={formData.password}
              onChange={(value) => setFormData((prev) => ({ ...prev, password: value }))}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
            <PasswordInput
              label={content.confirmPassword}
              value={formData.confirmPassword}
              onChange={(value) => setFormData((prev) => ({ ...prev, confirmPassword: value }))}
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
            />
            {formData.confirmPassword && !passwordsMatch ? (
              <p className="text-sm text-red-600">{content.mismatch}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isLoading || !canSubmit}
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

          <button type="button" onClick={onNavigateToLogin} className="mt-6 text-sm font-semibold text-[var(--navtoai-primary)]">
            {content.login}
          </button>
        </form>
      </div>
    </MarketplaceFrame>
  );
});

function FieldIconInput({
  label,
  value,
  onChange,
  icon,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{label}</span>
      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--navtoai-copy-soft)]">{icon}</div>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] pl-11 pr-4 text-sm text-[var(--navtoai-ink)] outline-none"
        />
      </div>
    </label>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{label}</span>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--navtoai-copy-soft)]" />
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] pl-11 pr-12 text-sm text-[var(--navtoai-ink)] outline-none"
        />
        <button type="button" onClick={onToggle} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--navtoai-copy-soft)]">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}


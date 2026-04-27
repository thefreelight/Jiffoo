import React from 'react';
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import type { AuthCallbackPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getAuthCopy(locale?: string, error?: string | null) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      title: error ? '登入驗證未完成。' : '正在完成登入驗證。',
      body: error ? error : '請稍候，我們正在確認你的登入資訊並返回 NavtoAI。',
      retry: '重試',
      home: '返回首頁',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      title: error ? '登录验证未完成。' : '正在完成登录验证。',
      body: error ? error : '请稍候，我们正在确认你的登录信息并返回 NavtoAI。',
      retry: '重试',
      home: '返回首页',
    };
  }

  return {
    title: error ? 'Authentication did not complete.' : 'Finishing your sign-in.',
    body: error ? error : 'Please wait while we verify your login and send you back to NavtoAI.',
    retry: 'Retry',
    home: 'Back home',
  };
}

export const AuthCallbackPage = React.memo(function AuthCallbackPage({
  provider,
  isLoading,
  error,
  locale,
  config,
  onRetry,
  onNavigateToHome,
}: AuthCallbackPageProps) {
  const content = getAuthCopy(locale, error);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-xl rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
            {error ? (
              <AlertCircle className="h-10 w-10" />
            ) : isLoading ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <ShieldCheck className="h-10 w-10" />
            )}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navtoai-copy-soft)]">
            {provider ? `${provider} auth` : 'Authentication'}
          </p>
          <h1 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
            {content.title}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--navtoai-copy)]">{content.body}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white"
              >
                {content.retry}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNavigateToHome}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--navtoai-ink)]"
            >
              {content.home}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </MarketplaceFrame>
  );
});


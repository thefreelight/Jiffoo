import React from 'react';
import { ArrowRight, SearchX } from 'lucide-react';
import type { NotFoundProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getNotFoundCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      title: '你要找的頁面不見了。',
      body: '可能已被移動、下架，或這個網址本來就不存在。',
      cta: '回到首頁',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      title: '你要找的页面不见了。',
      body: '它可能已经被移动、下架，或者这个地址本来就不存在。',
      cta: '返回首页',
    };
  }

  return {
    title: 'The page you wanted is gone.',
    body: 'It may have moved, been removed, or never existed in this directory.',
    cta: 'Back to home',
  };
}

export const NotFound = React.memo(function NotFound({ locale, config, message, onGoHome }: NotFoundProps) {
  const content = getNotFoundCopy(locale);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-xl rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
            <SearchX className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
            404
          </h1>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">{content.title}</h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--navtoai-copy)]">
            {message || content.body}
          </p>
          <button
            type="button"
            onClick={onGoHome}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white shadow-[var(--navtoai-glow)]"
          >
            {content.cta}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </MarketplaceFrame>
  );
});


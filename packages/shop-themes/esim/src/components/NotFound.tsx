import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { NotFoundProps } from 'shared/src/types/theme';
import { pickCopy } from '../site';

/**
 * 404 for unknown routes. The shared default component is English-only; this
 * one follows the storefront locale so a mistyped URL never switches
 * language. A host-supplied `message` is ignored for the same reason.
 */
export function NotFound({ route, locale, onGoHome }: NotFoundProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--esim-bg)] px-4 py-24 text-center">
      <div className="max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-gold)]">404</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[var(--esim-ink)]">
          {pickCopy(locale, { en: 'Page Not Found', hans: '页面不存在', hant: '頁面不存在' })}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--esim-copy)]">
          {route
            ? pickCopy(locale, {
                en: `Sorry, we couldn't find the page "${route}" you're looking for.`,
                hans: `抱歉，找不到页面「${route}」。`,
                hant: `抱歉，找不到頁面「${route}」。`,
                ja: `お探しのページ「${route}」は見つかりませんでした。`,
                ko: `찾으시는 페이지 "${route}"을(를) 찾을 수 없어요.`,
                fr: `Désolé, la page « ${route} » est introuvable.`,
                de: `Leider konnte die Seite „${route}“ nicht gefunden werden.`,
              })
            : pickCopy(locale, {
                en: "Sorry, we couldn't find the page you're looking for.",
                hans: '抱歉，找不到您要访问的页面。',
                hant: '抱歉，找不到您要存取的頁面。',
                ja: 'お探しのページは見つかりませんでした。',
                ko: '찾으시는 페이지를 찾을 수 없어요.',
                fr: 'Désolé, la page est introuvable.',
                de: 'Leider konnte die Seite nicht gefunden werden.',
              })}
        </p>
        <button
          type="button"
          onClick={onGoHome}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--esim-line-strong)] bg-[color:color-mix(in_oklab,var(--esim-bg-soft)_60%,transparent)] px-5 py-3 text-sm font-semibold text-[var(--esim-ink)] transition-colors hover:border-[var(--esim-gold)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {pickCopy(locale, { en: 'Back to Home', hans: '返回首页', hant: '返回首頁' })}
        </button>
        <p className="mt-8 text-xs leading-6 text-[var(--esim-copy-soft)]">
          {pickCopy(locale, {
            en: 'If you believe this is an error, please contact our support team.',
            hans: '如果您认为这是错误，请联系客服团队。',
            hant: '如果您認為這是錯誤，請聯絡客服團隊。',
          })}
        </p>
      </div>
    </div>
  );
}

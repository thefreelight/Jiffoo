import React from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import type { AuthCallbackPageProps } from 'shared/src/types/theme';
import { type ThemeCopy, pickCopy, resolveEsimSiteConfig } from '../site';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--esim-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--esim-bg)]';

export function AuthCallbackPage({
  isLoading,
  error,
  config,
  locale,
  onRetry,
  onNavigateToHome,
}: AuthCallbackPageProps) {
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--esim-bg)] px-4 py-12 text-[var(--esim-ink)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--esim-gold)_18%,transparent),transparent_26%),linear-gradient(180deg,var(--esim-bg),color-mix(in_oklab,var(--esim-bg)_84%,black))]" />
        <div className="absolute inset-0 opacity-40 [background-image:var(--esim-grid)] [background-size:72px_72px]" />
      </div>

      <section className="relative w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--esim-bg-elevated)_94%,white),var(--esim-bg-elevated))] p-5 shadow-[var(--esim-shadow)] sm:p-7">
        <div className="rounded-[1.1rem] border border-[var(--esim-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-gold)_12%,transparent)] text-[var(--esim-gold)]">
            {error ? <AlertTriangle className="h-7 w-7" /> : isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--esim-gold)]">
            {accountLabel}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--esim-ink)]">
            {error ? t({ en: 'Authentication failed', hans: '身份验证失败', hant: '身分驗證失敗' }) : t({ en: 'Completing sign in', hans: '正在完成登录', hant: '正在完成登入' })}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--esim-copy)]">
            {error || t({ en: 'Securing your session and returning you to the BOKMOO storefront.', hans: '正在保护您的登录会话，即将返回 BOKMOO 商城。', hant: '正在保護您的登入工作階段，即將返回 BOKMOO 商城。' })}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onRetry}
              className={`inline-flex min-h-12 items-center justify-center rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--esim-ink)] transition-colors hover:border-[var(--esim-gold)] hover:text-[var(--esim-gold)] ${FOCUS_VISIBLE_RING}`}
            >
              {t({ en: 'Back to sign in', hans: '返回登录', hant: '返回登入' })}
            </button>
            <button
              type="button"
              onClick={onNavigateToHome}
              className={`inline-flex min-h-12 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_88%,white),color-mix(in_oklab,var(--esim-gold)_64%,black))] px-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--esim-bg)] ${FOCUS_VISIBLE_RING}`}
            >
              {t({ en: 'Home', hans: '首页', hant: '首頁' })}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

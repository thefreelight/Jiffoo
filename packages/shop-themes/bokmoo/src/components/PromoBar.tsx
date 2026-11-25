import React from 'react';
import { pickCopy } from '../site';
import { countdown, useActiveSales, type Sale } from '../lib/sale';

const dismissedKey = (saleId: string): string => `bokmoo:promo-bar-dismissed:${saleId}`;

function readDismissed(saleId: string): boolean {
  try {
    return window.sessionStorage.getItem(dismissedKey(saleId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Site-wide announcement of the running promotion, shown above the header on
 * every page. It appears only while a promotion with banner copy is running
 * and goes away on its own when the promotion ends; a visitor can dismiss it
 * for the session.
 */
export const PromoBar = React.memo(function PromoBar({ locale }: { locale?: string }) {
  const sales = useActiveSales(locale);
  const sale: Sale | null = sales.find((entry) => entry.activeNow && entry.banner) ?? null;
  const [dismissed, setDismissed] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!sale || !sale.banner) return null;
  if (dismissed === sale.id || readDismissed(sale.id)) return null;

  const remaining = countdown(sale.endsAt, now);
  const dismiss = () => {
    setDismissed(sale.id);
    try {
      window.sessionStorage.setItem(dismissedKey(sale.id), '1');
    } catch {
      /* private mode: dismissing lasts for the page */
    }
  };

  return (
    <div className="bokmoo-promo-bar" data-purpose="promo-bar" role="region" aria-label={pickCopy(locale, { en: 'Current offer', hans: '当前优惠', hant: '目前優惠', ja: '現在のキャンペーン', ko: '진행 중인 프로모션', fr: 'Offre en cours', de: 'Aktuelles Angebot' })}>
      <a className="bokmoo-promo-bar-link" href={sale.rulesUrl ?? '#'}>
        <span className="bokmoo-promo-bar-badge">
          {sale.discountType === 'percent' ? `-${Math.round(sale.discountValue)}%` : 'DEAL'}
        </span>
        <span>{sale.banner.title}</span>
        {remaining ? <span className="bokmoo-promo-bar-timer">{remaining}</span> : null}
      </a>
      <button className="bokmoo-promo-bar-close" type="button" onClick={dismiss} aria-label={pickCopy(locale, { en: 'Dismiss', hans: '关闭', hant: '關閉', ja: '閉じる', ko: '닫기', fr: 'Fermer', de: 'Schließen' })}>
        ✕
      </button>
    </div>
  );
});

import React from 'react';
import { pickCopy } from '../site';
import type { Sale } from '../lib/sale';
import { campaignCopy, campaignTickLabels, campaignTicks } from '../lib/campaign-bar';

const ArrowRight = React.memo(function ArrowRight() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
      <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

const Cross = React.memo(function Cross() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

/**
 * The campaign bar: the promotion's announcement above the header, drawn from the "campaign" template —
 * a badge, the offer with its highlight in gold, the window and a countdown, a button, and a way to
 * dismiss it. The words come from the promotion (`campaignCopy`); the look is the theme's own stylesheet
 * (`.bokmoo-campaign-*`), so it travels with a theme release.
 */
export const CampaignPromoBar = React.memo(function CampaignPromoBar({ sale, locale, onDismiss }: {
  sale: Sale;
  locale?: string;
  onDismiss: () => void;
}) {
  const [ticks, setTicks] = React.useState(() => campaignTicks(sale.endsAt));

  React.useEffect(() => {
    const update = () => setTicks(campaignTicks(sale.endsAt));
    update();
    const timer = window.setInterval(update, 1000);
    // a tab nobody is looking at does not need to tick; it catches up when it is seen again
    const onVisibility = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sale.endsAt]);

  const copy = campaignCopy(sale, locale);
  const labels = ticks ? campaignTickLabels(ticks, locale) : null;
  const dismissLabel = pickCopy(locale, { en: 'Dismiss', hans: '关闭', hant: '關閉', ja: '閉じる', ko: '닫기', fr: 'Fermer', de: 'Schließen' });

  return (
    <div
      className="bokmoo-campaign-bar"
      data-purpose="promo-bar"
      data-template="campaign"
      role="region"
      aria-label={pickCopy(locale, { en: 'Current offer', hans: '当前优惠', hant: '目前優惠', ja: '現在のキャンペーン', ko: '진행 중인 프로모션', fr: 'Offre en cours', de: 'Aktuelles Angebot' })}
    >
      <div className="bokmoo-campaign-bar-inner">
        <div className="bokmoo-campaign-bar-main">
          {copy.badge ? (
            <span className="bokmoo-campaign-badge">
              <span className="bokmoo-campaign-badge-dot" aria-hidden="true" />
              {copy.badge}
            </span>
          ) : null}
          <span className="bokmoo-campaign-text">
            {copy.subject ? <span className="bokmoo-campaign-subject">{copy.subject}</span> : null}
            {copy.lead ? (
              <span className="bokmoo-campaign-lead">
                <span aria-hidden="true">—</span> {copy.lead}
              </span>
            ) : copy.subject && copy.highlight ? (
              <span className="bokmoo-campaign-lead" aria-hidden="true">—</span>
            ) : null}
            {copy.highlight ? <span className="bokmoo-campaign-highlight">{copy.highlight}</span> : null}
            {copy.note ? (
              <>
                <span className="bokmoo-campaign-divider" aria-hidden="true">|</span>
                <span className="bokmoo-campaign-note">{copy.note}</span>
              </>
            ) : null}
          </span>
          {labels ? (
            <span
              className="bokmoo-campaign-countdown"
              role="timer"
              aria-label={`${copy.countdownLabel} ${labels[0]} : ${labels[1]} : ${labels[2]} : ${labels[3]}`}
            >
              <span className="bokmoo-campaign-countdown-label">{copy.countdownLabel}</span>
              <span className="bokmoo-campaign-tick" aria-hidden="true">{labels[0]}</span>
              <span className="bokmoo-campaign-colon" aria-hidden="true">:</span>
              <span className="bokmoo-campaign-tick" aria-hidden="true">{labels[1]}</span>
              <span className="bokmoo-campaign-colon" aria-hidden="true">:</span>
              <span className="bokmoo-campaign-tick" aria-hidden="true">{labels[2]}</span>
              <span className="bokmoo-campaign-colon" aria-hidden="true">:</span>
              <span className="bokmoo-campaign-tick" aria-hidden="true">{labels[3]}</span>
            </span>
          ) : null}
        </div>
        <div className="bokmoo-campaign-actions">
          <a className="bokmoo-campaign-cta" href={sale.rulesUrl ?? '#products'}>
            <span>{copy.cta}</span>
            <ArrowRight />
          </a>
          <button className="bokmoo-campaign-close" type="button" onClick={onDismiss} aria-label={dismissLabel}>
            <Cross />
          </button>
        </div>
      </div>
    </div>
  );
});

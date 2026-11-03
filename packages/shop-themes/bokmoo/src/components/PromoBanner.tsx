import React from 'react';
import { resolveBokmooSiteConfig } from '../site';

type PromoEntry = {
  banner: { title: string; body: string } | null;
  endsAt: string;
  rulesUrl: string | null;
  discountType: string;
  discountValue: number;
};

type PromoState = 'loading' | 'idle' | 'ready';

const PROMO_LOCALE: Record<string, string> = {
  en: 'en', hans: 'zh-Hans', hant: 'zh-Hant', ja: 'ja', ko: 'ko', fr: 'fr', de: 'de',
};

function useCountdown(endsAt: string | null): string | null {
  const [label, setLabel] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!endsAt) return;
    const target = Date.parse(endsAt);
    if (Number.isNaN(target)) return;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setLabel(null); return; }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`);
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  return label;
}

/**
 * Admin-configured campaign banner (Black Friday and future windows).
 * Reads the public promotions endpoint; renders nothing while idle so
 * non-campaign weeks keep the page exactly as before.
 */
export const PromoBanner = React.memo(function PromoBanner({ locale, config }: {
  locale?: string;
  config?: unknown;
}) {
  const site = resolveBokmooSiteConfig(config, locale);
  const [state, setState] = React.useState<PromoState>('loading');
  const [promo, setPromo] = React.useState<PromoEntry | null>(null);
  const countdown = useCountdown(promo?.endsAt ?? null);

  React.useEffect(() => {
    let cancelled = false;
    const apiLocale = PROMO_LOCALE[locale ?? 'en'] ?? 'en';
    fetch(`${site.apiBaseUrl}/api/v1/promotions/active?locale=${encodeURIComponent(apiLocale)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { items?: PromoEntry[] } } | null) => {
        if (cancelled) return;
        const entry = payload?.data?.items?.[0] ?? null;
        if (entry?.banner) { setPromo(entry); setState('ready'); } else { setState('idle'); }
      })
      .catch(() => { if (!cancelled) setState('idle'); });
    return () => { cancelled = true; };
  }, [locale, site.apiBaseUrl]);

  if (state !== 'ready' || !promo?.banner) return null;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4">
      <a
        href={promo.rulesUrl ?? '#'}
        onClick={(event) => { if (!promo.rulesUrl) event.preventDefault(); }}
        className="block rounded-2xl border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,#0b0c10)] px-5 py-4 transition hover:border-[var(--bokmoo-gold)]"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="rounded-full bg-[var(--bokmoo-gold)] px-3 py-1 text-xs font-bold text-[#0b0c10]">
            {promo.discountType === 'percent' ? `-${Math.round(promo.discountValue)}%` : 'DEAL'}
          </span>
          <span className="text-base font-bold text-[var(--bokmoo-gold)]">{promo.banner.title}</span>
          {countdown ? (
            <span className="ml-auto text-xs font-semibold text-[color:color-mix(in_oklab,var(--bokmoo-gold)_70%,white)]">
              ⏳ {countdown}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm text-[color:color-mix(in_oklab,white_78%,transparent)]">{promo.banner.body}</p>
      </a>
    </div>
  );
});

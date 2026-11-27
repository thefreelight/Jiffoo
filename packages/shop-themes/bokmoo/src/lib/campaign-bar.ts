import { pickCopy } from '../site';
import type { Sale } from './sale';

/**
 * The campaign bar: the announcement bar of a promotion drawn from a template — a badge, the offer with
 * its highlight in gold, the window and a countdown, a button, and a way to dismiss it. Taken from the
 * Stitch design "BOKMOO - Global Connectivity Landing Page (Black Friday English Edition)".
 *
 * Every word comes from the promotion, in the shopper's language: what the store did not write is left
 * out, or taken from the promotion itself (the discount, the window, the end of the sale). So the same
 * template serves the next campaign with its own copy.
 */

/** "02" "14" "35" "18": what the four boxes of the countdown show. Null once the promotion is over. */
export interface CampaignTicks {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function campaignTicks(endsAt: string | null | undefined, now: number = Date.now()): CampaignTicks | null {
  const target = Date.parse(endsAt || '');
  if (!Number.isFinite(target) || target <= now) return null;
  const total = Math.floor((target - now) / 1000);
  return {
    days: pad(Math.floor(total / 86_400)),
    hours: pad(Math.floor((total % 86_400) / 3_600)),
    minutes: pad(Math.floor((total % 3_600) / 60)),
    seconds: pad(total % 60),
  };
}

type Family = 'en' | 'hans' | 'hant' | 'ja' | 'ko' | 'fr' | 'de';

function familyOf(locale: string | undefined): Family {
  const value = (locale || 'en').toLowerCase();
  if (/^zh-hant|^zh-hk|^zh-tw|^zh-mo/.test(value) || value === 'hant') return 'hant';
  if (/^hans$|^zh/.test(value)) return 'hans';
  if (value === 'ja' || value === 'ko' || value === 'fr' || value === 'de') return value;
  return 'en';
}

/** How the language tags the storefront uses are written for date formatting. */
function dateTag(family: Family): string {
  return family === 'hans' ? 'zh-Hans' : family === 'hant' ? 'zh-Hant' : family;
}

const TICK_UNITS: Record<Family, { days: string; hours: string; minutes: string; seconds: string }> = {
  // the design's English edition: "02d 14h 35m 18s"
  en: { days: 'd', hours: 'h', minutes: 'm', seconds: 's' },
  // the design's Chinese edition: "02天 : 14 : 35 : 18" — only the days are named
  hans: { days: '天', hours: '', minutes: '', seconds: '' },
  hant: { days: '天', hours: '', minutes: '', seconds: '' },
  ja: { days: '日', hours: '', minutes: '', seconds: '' },
  ko: { days: '일', hours: '', minutes: '', seconds: '' },
  fr: { days: 'j', hours: 'h', minutes: 'min', seconds: 's' },
  de: { days: 'T', hours: 'h', minutes: 'min', seconds: 's' },
};

/** What each box of the countdown says, in the shopper's language. */
export function campaignTickLabels(ticks: CampaignTicks, locale: string | undefined): [string, string, string, string] {
  const units = TICK_UNITS[familyOf(locale)];
  return [
    `${ticks.days}${units.days}`,
    `${ticks.hours}${units.hours}`,
    `${ticks.minutes}${units.minutes}`,
    `${ticks.seconds}${units.seconds}`,
  ];
}

export function campaignCountdownLabel(locale: string | undefined): string {
  return pickCopy(locale, {
    en: 'Ends in:', hans: '距结束仅剩', hant: '距結束僅剩', ja: '終了まで', ko: '종료까지', fr: 'Fin dans :', de: 'Endet in:',
  });
}

/** "Nov 27 – Nov 30": the days of the promotion, in the shopper's language, when the store wrote no window of its own. */
export function campaignWindowLabel(startsAt: string | null | undefined, endsAt: string | null | undefined, locale: string | undefined): string | null {
  const start = Date.parse(startsAt || '');
  const end = Date.parse(endsAt || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const tag = dateTag(familyOf(locale));
  const day: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  // the promotion ends at the first instant after its last day: name that last day
  const last = new Date(end - 1);
  const sameYear = new Date(start).getUTCFullYear() === last.getUTCFullYear();
  const first = new Intl.DateTimeFormat(tag, sameYear ? day : { ...day, year: 'numeric' }).format(start);
  return `${first} – ${new Intl.DateTimeFormat(tag, day).format(last)}`;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Chinese names a discount the other way round: 20% off is 8 折, 15% off is 8.5 折. */
function zhe(percent: number): string {
  const folded = round((100 - percent) / 10);
  return `${folded} 折`;
}

/** The offer in gold: what the store wrote, else the promotion's own discount. */
export function campaignHighlight(sale: Sale, locale: string | undefined): string | null {
  const written = sale.banner?.highlight?.trim();
  if (written) return written;
  const percent = round(sale.discountValue);
  if (sale.discountType === 'percent') {
    return pickCopy(locale, {
      en: `${percent}% OFF`, hans: zhe(percent), hant: zhe(percent), ja: `${percent}% OFF`, ko: `${percent}% 할인`, fr: `−${percent} %`, de: `${percent} % Rabatt`,
    });
  }
  return pickCopy(locale, {
    en: `$${percent} OFF`, hans: `减 $${percent}`, hant: `減 $${percent}`, ja: `$${percent} OFF`, ko: `$${percent} 할인`, fr: `−${percent} $`, de: `${percent} $ Rabatt`,
  });
}

/** What the button says: what the store wrote, else an invitation to take the promotion's discount. */
export function campaignCta(sale: Sale, locale: string | undefined): string {
  const written = sale.banner?.cta?.trim();
  if (written) return written;
  const percent = round(sale.discountValue);
  if (sale.discountType === 'percent') {
    return pickCopy(locale, {
      en: `Claim ${percent}% OFF`, hans: `立即享受 ${zhe(percent)}`, hant: `立即享受 ${zhe(percent)}`, ja: `${percent}% OFF を受け取る`, ko: `${percent}% 할인 받기`,
      fr: `Obtenir −${percent} %`, de: `${percent} % Rabatt sichern`,
    });
  }
  return pickCopy(locale, {
    en: `Claim $${percent} off`, hans: `立即立减 $${percent}`, hant: `立即立減 $${percent}`, ja: `$${percent} OFF を受け取る`, ko: `$${percent} 할인 받기`,
    fr: `Obtenir −${percent} $`, de: `${percent} $ Rabatt sichern`,
  });
}

/** What the bar says about the promotion, in the shopper's language: every piece, with its fallback. */
export function campaignCopy(sale: Sale, locale: string | undefined): {
  badge: string | null;
  subject: string | null;
  lead: string | null;
  highlight: string | null;
  note: string | null;
  cta: string;
  countdownLabel: string;
} {
  const text = (value: string | undefined): string | null => (value && value.trim() ? value.trim() : null);
  return {
    badge: text(sale.banner?.badge),
    // without a subject of its own, the banner's title is the offer
    subject: text(sale.banner?.subject) ?? text(sale.banner?.title),
    lead: text(sale.banner?.lead),
    highlight: campaignHighlight(sale, locale),
    note: text(sale.banner?.note) ?? campaignWindowLabel(sale.startsAt, sale.endsAt, locale),
    cta: campaignCta(sale, locale),
    countdownLabel: campaignCountdownLabel(locale),
  };
}

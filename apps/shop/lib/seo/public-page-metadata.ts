/**
 * Public page SEO metadata generator.
 *
 * Centralises title / description / canonical / hreflang / OG locale for the
 * indexable marketing pages. Each server wrapper page calls the shared helper
 * to emit a consistent, locale-aware Metadata object.
 */

import type { Metadata } from 'next';

/* ------------------------------------------------------------------ */
/*  Per-page, per-locale content map                                   */
/* ------------------------------------------------------------------ */

const PAGE_META = {
  home: {
    en: {
      title: '{brand} – One Card, Connected to Your World',
      description:
        '{brand} is a physical eSIM card for global travelers. 200+ countries and regions, flexible plans, effortless management.',
    },
    'zh-Hant': {
      title: '{brand} – 一張卡，連接你的世界',
      description:
        '{brand} 為全球旅行者打造的實體 eSIM 卡。支援 200+ 國家和地區，靈活套餐，輕鬆管理。',
    },
    jsonLd: true,
  },
  pricing: {
    en: {
      title: 'Plans & Pricing',
      description:
        'Compare {brand} plans and find the right connectivity option for your next trip.',
    },
    'zh-Hant': {
      title: '套餐與定價',
      description:
        '比較 {brand} 套餐，為你的下一次旅行選擇合適的連接方案。',
    },
  },
  contact: {
    en: {
      title: 'Contact Us',
      description:
        'Get in touch with the {brand} team — activation help, plan questions, and 24/7 global support.',
    },
    'zh-Hant': {
      title: '聯絡我們',
      description:
        '聯絡 {brand} 團隊——啟用協助、套餐問題，以及 24/7 全球支援。',
    },
  },
  help: {
    en: {
      title: 'Help Center',
      description:
        'Learn how to install eSIM profiles, manage plans per card, and switch destinations in the {brand} app.',
    },
    'zh-Hant': {
      title: '幫助中心',
      description:
        '了解如何在 {brand} App 中安裝 eSIM、按卡片管理套餐，並隨時切換目的地。',
    },
  },
  privacy: {
    en: {
      title: 'Privacy Policy',
      description:
        'How {brand} collects, uses, and protects the account and order information required to operate the service.',
    },
    'zh-Hant': {
      title: '隱私權政策',
      description:
        '{brand} 如何收集、使用和保護營運服務所需的帳戶與訂單資訊。',
    },
  },
  terms: {
    en: {
      title: 'Terms of Service',
      description:
        'Clear terms covering purchases, payments, eSIM activation, and acceptable use of {brand} services.',
    },
    'zh-Hant': {
      title: '服務條款',
      description:
        '涵蓋購買、付款、eSIM 啟用與 {brand} 服務合理使用的明確條款。',
    },
  },
  'how-it-works': {
    en: {
      title: 'How It Works',
      description:
        'Connect the {brand} card, add an eSIM plan, and switch destinations — from the card to a connected world.',
    },
    'zh-Hant': {
      title: '運作方式',
      description:
        '連接 {brand} 卡片、添加 eSIM 套餐並切換目的地——從一張卡到連接世界。',
    },
  },
  'download/app': {
    en: {
      title: 'Get the {brand} App',
      description:
        'Download the {brand} app for iOS and Android — activate your card over Bluetooth, install eSIM profiles, and track data on the go.',
    },
    'zh-Hant': {
      title: '取得 {brand} App',
      description:
        '下載 {brand} iOS 與 Android App——藍牙啟用您的卡片、安裝 eSIM 配置檔，隨時掌握數據用量。',
    },
  },
} satisfies Record<string, { en: { title: string; description: string }; 'zh-Hant': { title: string; description: string }; jsonLd?: boolean }>;

type PageRoute = keyof typeof PAGE_META;

function ogLocale(locale: string): string {
  return locale === 'zh-Hant' ? 'zh_TW' : 'en_US';
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function generatePublicPageMetadata({
  route,
  locale,
  origin,
  brandName,
}: {
  route: PageRoute;
  locale: string;
  origin: string;
  brandName?: string;
}): Metadata {
  const meta = PAGE_META[route];
  const lang = locale === 'zh-Hant' ? 'zh-Hant' : 'en';
  const brand = brandName?.trim() || 'BOKMOO';
  const { title: rawTitle, description: rawDescription } = meta[lang]!;
  const title = rawTitle.split('{brand}').join(brand);
  const description = rawDescription.split('{brand}').join(brand);

  const base = new URL(origin);
  const urlPath = `/${locale}/${route === 'home' ? '' : route}`;
  const canonical = new URL(urlPath, base).toString();

  const alternateEn = new URL(`/${lang === 'en' ? 'en' : 'en'}/${route === 'home' ? '' : route}`, base).toString();
  const alternateZh = new URL(`/zh-Hant/${route === 'home' ? '' : route}`, base).toString();

  const socialImageUrl = new URL('/icon-512x512.png', base).toString();

  const metadata: Metadata = {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: alternateEn,
        'zh-Hant': alternateZh,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: brandName || undefined,
      locale: ogLocale(locale),
      type: 'website',
      images: [{ url: socialImageUrl, width: 512, height: 512, alt: brandName || title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImageUrl],
    },
  };

  return metadata;
}

/* ------------------------------------------------------------------ */
/*  JSON-LD (home page only)                                           */
/* ------------------------------------------------------------------ */

export function homeJsonLd(origin: string, brandName = 'BOKMOO'): string {
  const base = new URL(origin);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brandName,
    url: base.toString(),
    description:
      `${brandName} is a physical eSIM card for global travelers — 200+ countries and regions with flexible plans.`,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}en/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  });
}

export function organizationJsonLd(origin: string, brandName = 'BOKMOO'): string {
  const base = new URL(origin);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brandName,
    url: base.toString(),
    logo: new URL('/icon-512x512.png', base).toString(),
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['English', 'Chinese'],
    },
  });
}

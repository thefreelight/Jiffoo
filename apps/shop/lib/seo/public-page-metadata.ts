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
      title: 'RemoteRadar – Remote Job Search & Application Toolkit',
      description:
        'RemoteRadar continuously scans trusted sources, explains why each role matches your profile, and helps you prepare a stronger application.',
    },
    'zh-Hant': {
      title: 'RemoteRadar – 遠端求職搜尋與投遞助手',
      description:
        'RemoteRadar 持續掃描可靠的職缺來源，說明每個職位為何與你的履歷匹配，並協助你準備更具說服力的求職申請。',
    },
    jsonLd: true,
  },
  pricing: {
    en: {
      title: 'Pricing',
      description:
        'Compare RemoteRadar plans — free tier, Pro, and Power — to choose the right cadence for your remote job search.',
    },
    'zh-Hant': {
      title: '定價方案',
      description:
        '比較 RemoteRadar 方案——免費版、Pro 與 Power——選擇最適合你的求職節奏。',
    },
  },
  contact: {
    en: {
      title: 'Contact Us',
      description:
        'Get in touch with the RemoteRadar team to discuss your target markets, current hiring pipeline, and what you want from the first round of research.',
    },
    'zh-Hant': {
      title: '聯絡我們',
      description:
        '與 RemoteRadar 團隊溝通你的目標市場、目前的招聘流程，以及你希望第一輪研究獲得什麼結果。',
    },
  },
  help: {
    en: {
      title: 'Help Center',
      description:
        'Learn how to create job projects, set exclusion rules, review evidence, and approve outreach before it goes out.',
    },
    'zh-Hant': {
      title: '幫助中心',
      description:
        '了解如何建立職缺專案、設定排除規則、檢視證據，並在發送前核准每次觸達。',
    },
  },
  privacy: {
    en: {
      title: 'Privacy Policy',
      description:
        'RemoteRadar stores only the account, project, and lead data required to operate the service. Delete and suppression requests are applied immediately.',
    },
    'zh-Hant': {
      title: '隱私權政策',
      description:
        'RemoteRadar 僅儲存運作所需的帳號、專案與候選人資料，刪除與停權請求會立即生效。',
    },
  },
  terms: {
    en: {
      title: 'Terms of Service',
      description:
        'Clear and transparent terms covering remote job research, sourcing permissions, approval workflows, and acceptable use.',
    },
    'zh-Hant': {
      title: '服務條款',
      description:
        '涵蓋遠端職缺研究、資料來源授權、審核工作流與合理使用的明確條款。',
    },
  },
  'how-it-works': {
    en: {
      title: 'How It Works',
      description:
        'See how RemoteRadar scans sources, matches roles to your profile, and turns each opportunity into a ready-to-send application.',
    },
    'zh-Hant': {
      title: '運作方式',
      description:
        '了解 RemoteRadar 如何掃描來源、將職位與你的檔案匹配，並把每個機會轉為可直接寄出的申請。',
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
  const { title, description } = meta[lang]!;

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

export function homeJsonLd(origin: string): string {
  const base = new URL(origin);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RemoteRadar',
    url: base.toString(),
    description:
      'RemoteRadar continuously scans trusted sources, explains why each role matches your profile, and helps you prepare a stronger application.',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}en/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  });
}

export function organizationJsonLd(origin: string): string {
  const base = new URL(origin);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RemoteRadar',
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

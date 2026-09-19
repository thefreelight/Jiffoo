import React from 'react';
import {
  ArrowRight,
  CreditCard,
  Globe2,
  Headphones,
  QrCode,
  ShieldCheck,
  Signal,
  Smartphone,
  Sparkles,
  WalletCards,
  Zap,
} from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { displayProductTitle, getBokmooProducts, resolveBokmooMediaUrl } from '../lib/api';
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

type HeroPillarProps = {
  className: string;
};

type HomeProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
};

const BOKMOO_HERO_CARD_SRC = '/theme-assets/bokmoo/bokmoo-hero-card-product.png?v=20260716';
const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

function HeroPillar({ className }: HeroPillarProps) {
  return (
    <div
      className={`absolute w-px bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--bokmoo-gold)_82%,transparent),transparent)] shadow-[0_0_52px_color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent)] ${className}`}
    />
  );
}

function WorldGlobe() {
  const dots = [
    [22, 44],
    [29, 36],
    [38, 51],
    [47, 32],
    [52, 45],
    [59, 39],
    [68, 50],
    [73, 35],
    [81, 43],
  ];

  return (
    <div className="absolute -right-[24%] top-[-5%] hidden h-[58rem] w-[92rem] opacity-100 lg:block xl:-right-[21%] 2xl:-right-[16%] 2xl:top-[-8%]">
      <div className="absolute inset-[-8%] rounded-full bg-[radial-gradient(circle_at_52%_52%,color-mix(in_oklab,var(--bokmoo-gold)_58%,transparent),transparent_58%)] blur-3xl" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 760 520" aria-hidden="true">
        <defs>
          <radialGradient id="bokmooGlobeGlow" cx="54%" cy="52%" r="48%">
            <stop offset="0%" stopColor="rgba(226,188,94,0.58)" />
            <stop offset="58%" stopColor="rgba(226,188,94,0.24)" />
            <stop offset="100%" stopColor="rgba(226,188,94,0)" />
          </radialGradient>
          <linearGradient id="bokmooGlobeLine" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(244,203,111,0)" />
            <stop offset="48%" stopColor="rgba(244,203,111,0.88)" />
            <stop offset="100%" stopColor="rgba(244,203,111,0)" />
          </linearGradient>
        </defs>
        <ellipse cx="430" cy="260" rx="310" ry="180" fill="url(#bokmooGlobeGlow)" />
        <ellipse cx="430" cy="260" rx="318" ry="182" fill="none" stroke="rgba(226,188,94,0.52)" strokeWidth="1.6" />
        <ellipse cx="430" cy="260" rx="245" ry="126" fill="none" stroke="rgba(226,188,94,0.36)" strokeWidth="1.2" />
        <ellipse cx="430" cy="260" rx="150" ry="78" fill="none" stroke="rgba(226,188,94,0.28)" strokeWidth="1.1" />
        <path d="M150 264 C270 210 410 208 548 248 C604 264 664 258 714 226" fill="none" stroke="url(#bokmooGlobeLine)" strokeWidth="2.6" />
        <path d="M168 310 C286 260 390 286 498 322 C572 346 640 334 710 292" fill="none" stroke="rgba(226,188,94,0.46)" strokeWidth="1.7" />
        <path d="M202 220 C316 178 468 172 612 214" fill="none" stroke="rgba(226,188,94,0.34)" strokeWidth="1.35" />
        <path d="M300 120 C342 212 342 316 302 404" fill="none" stroke="rgba(226,188,94,0.34)" strokeWidth="1.2" />
        <path d="M430 84 C410 198 412 322 456 432" fill="none" stroke="rgba(226,188,94,0.4)" strokeWidth="1.3" />
        <path d="M570 128 C530 220 528 320 592 410" fill="none" stroke="rgba(226,188,94,0.32)" strokeWidth="1.2" />
        {dots.map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={(x / 100) * 760}
            cy={(y / 100) * 520}
            r="4.6"
            fill="rgba(244,203,111,0.96)"
            filter="drop-shadow(0 0 14px rgba(244,203,111,0.82))"
          />
        ))}
      </svg>
    </div>
  );
}

export const HomePage = React.memo(function HomePage({ locale, config, onNavigate }: HomePageProps) {
  const site = resolveBokmooSiteConfig(config);
  const [homeProducts, setHomeProducts] = React.useState<HomeProduct[]>([]);
  const [homeProductsLoading, setHomeProductsLoading] = React.useState(true);
  const isZhHant = locale === 'zh-Hant';

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }

      const hashTarget = href.startsWith('/#') ? href.slice(2) : href.startsWith('#') ? href.slice(1) : '';
      if (hashTarget) {
        onNavigate?.(href);
        window.setTimeout(() => {
          document.getElementById(hashTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
        return;
      }

      onNavigate?.(href);
    },
    [onNavigate]
  );

  React.useEffect(() => {
    let cancelled = false;
    // The native core serves catalog reads from D1 snapshots keyed by the full
    // request query; this exact query string matches the maintained odoo-synced
    // snapshot row, so the homepage always renders the real synced product.
    void getBokmooProducts({ baseUrl: site.apiBaseUrl }, { page: 1, limit: 12, locale: 'en', type: 'esim' })
      .then((response) => {
        if (cancelled) return;
        setHomeProducts(
          response.items.map((item) => {
            const variantPrices = (item.variants || [])
              .map((variant) => Number(variant.salePrice || 0))
              .filter((price) => price > 0)
              .sort((a, b) => a - b);
            return {
              id: String(item.id || ''),
              name: displayProductTitle(item.name),
              description: String(item.description || ''),
              price: variantPrices[0] ?? Number(item.price || 0),
              image: resolveBokmooMediaUrl(item.images?.[0]?.url || item.image, site.apiBaseUrl),
            };
          })
        );
      })
      .catch(() => {
        if (!cancelled) setHomeProducts([]);
      })
      .finally(() => {
        if (!cancelled) setHomeProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [site.apiBaseUrl]);

  const reasonCards = [
    {
      title: 'Global Coverage',
      body: 'Access data in 200+ countries and regions with local rates.',
      icon: Globe2,
    },
    {
      title: 'Instant Activation',
      body: 'Install your eSIM profile in seconds, anytime, anywhere.',
      icon: Zap,
    },
    {
      title: 'Secure & Private',
      body: 'Your data and privacy are protected with top-tier security.',
      icon: ShieldCheck,
    },
    {
      title: '24/7 Support',
      body: 'Our global support team is here to help, anytime.',
      icon: Headphones,
    },
  ];

  const heroBadges = [
    { icon: Globe2, title: '200+ Countries', body: 'Coverage' },
    { icon: WalletCards, title: 'Instant Delivery', body: 'via eSIM' },
    { icon: ShieldCheck, title: 'Secure & Trusted', body: 'Platform' },
    { icon: Headphones, title: '24/7 Global', body: 'Support' },
  ];

  const steps = [
    {
      title: 'Get Your Card',
      body: 'Purchase a BOKMOO eUICC card and receive it securely.',
      icon: CreditCard,
    },
    {
      title: 'Install Profile',
      body: 'Scan QR code or enter activation details to install your eSIM profile.',
      icon: QrCode,
    },
    {
      title: 'Stay Connected',
      body: 'Enjoy fast, reliable data wherever you go.',
      icon: Smartphone,
    },
  ];

  const euiccFeatures = [
    {
      title: 'Multiple Profiles',
      body: 'Manage multiple eSIM profiles on one card.',
      icon: WalletCards,
    },
    {
      title: 'Easy Switch',
      body: 'Switch between profiles easily in our app.',
      icon: Sparkles,
    },
    {
      title: 'Wide Compatibility',
      body: 'Works with most eSIM-compatible devices.',
      icon: Signal,
    },
  ];

  const metrics = [
    { value: '200+', label: 'Countries & Regions' },
    { value: '1M+', label: 'Happy Users' },
    { value: '10M+', label: 'eSIM Profiles Delivered' },
    { value: '99.9%', label: 'Uptime Guarantee' },
  ];

  const heroTitleLines = React.useMemo(() => {
    const lines = site.headline
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.length > 0 ? lines : ['One Card.', 'Global Connection.'];
  }, [site.headline]);

  return (
    <div className="bg-[var(--bokmoo-bg)] text-[var(--bokmoo-ink)]">
      <section className="relative overflow-hidden border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] px-5 pb-12 pt-12 sm:px-8 lg:min-h-[calc(100vh-5.25rem)] lg:px-0 lg:pb-8 lg:pt-14 xl:min-h-[calc(100vh-6.75rem)] xl:pt-16 2xl:pt-[4.5rem]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_32%,color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent),transparent_36%),radial-gradient(circle_at_93%_12%,color-mix(in_oklab,var(--bokmoo-gold)_32%,transparent),transparent_24%),radial-gradient(circle_at_63%_86%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_25%),linear-gradient(90deg,var(--bokmoo-bg)_0%,var(--bokmoo-bg)_34%,color-mix(in_oklab,var(--bokmoo-gold)_12%,var(--bokmoo-bg))_69%,var(--bokmoo-bg)_100%)]" />
          <div className="absolute left-[41%] top-[-6%] hidden h-[104%] w-[76%] rounded-full bg-[var(--bokmoo-orbit-glow)] opacity-100 blur-3xl lg:block" />
          <div className="absolute right-[-18%] top-0 hidden h-full w-[82%] bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--bokmoo-gold)_27%,transparent)_44%,transparent)] lg:block" />
          <WorldGlobe />
          <HeroPillar className="left-[55%] top-[5%] hidden h-[72%] lg:block" />
          <HeroPillar className="left-[63%] top-[-4%] hidden h-[82%] lg:block" />
          <HeroPillar className="left-[72%] top-[5%] hidden h-[78%] lg:block" />
          <HeroPillar className="left-[82%] top-[10%] hidden h-[64%] lg:block" />
          <HeroPillar className="left-[92%] top-[18%] hidden h-[48%] lg:block" />
          <div className="absolute right-[-19%] top-[12%] hidden h-[58%] w-[72%] rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_54%,transparent)] opacity-70 blur-[1px] lg:block" />
          <div className="absolute bottom-[-18%] right-[-4%] h-[34rem] w-[34rem] rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_50%,transparent)] lg:h-[42rem] lg:w-[42rem]" />
          <div className="absolute bottom-[-1%] right-[6%] h-72 w-72 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] lg:h-96 lg:w-96" />
        </div>
        <img
          src={BOKMOO_HERO_CARD_SRC}
          alt=""
          className="pointer-events-none absolute right-[-108%] top-[22.5rem] z-0 block h-[33rem] w-[44rem] max-w-none select-none object-contain opacity-35 mix-blend-multiply [mask-image:radial-gradient(ellipse_82%_76%_at_52%_48%,black_52%,rgba(0,0,0,0.72)_72%,transparent_100%)] sm:right-[-58%] sm:top-[21rem] sm:h-[36rem] sm:w-[48rem] lg:hidden"
          draggable={false}
          aria-hidden="true"
        />

        <div className="relative mx-auto flex w-full max-w-[107rem] flex-col lg:min-h-[calc(100vh-13.25rem)] xl:min-h-[calc(100vh-14.75rem)]">
          <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(25rem,1.02fr)] lg:items-center xl:grid-cols-[minmax(0,0.96fr)_minmax(32rem,1.04fr)] 2xl:grid-cols-[minmax(0,0.94fr)_minmax(38rem,1.06fr)]">
            <div className="relative z-20 max-w-[68rem] pt-2">
              <div className="inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.7)] px-5 py-2.5 text-[0.78rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025)]">
                <Sparkles className="h-4 w-4" />
                {site.eyebrow}
              </div>

              <h1 className="mt-8 max-w-full text-[clamp(2.85rem,11.2vw,4.55rem)] font-black leading-[0.94] tracking-[-0.052em] text-[color:oklch(0.985_0.004_86)] sm:max-w-[16ch] lg:mt-9 lg:max-w-[17.5ch] lg:text-[clamp(4.3rem,5.45vw,6.2rem)] lg:leading-[0.92] xl:text-[clamp(5.1rem,5.45vw,7.35rem)] 2xl:text-[clamp(5.6rem,5.25vw,8rem)]">
                {heroTitleLines.map((line) => (
                  <span key={line} className="block [text-wrap:balance]">
                    {line}
                  </span>
                ))}
              </h1>

              <p className="mt-7 max-w-[43rem] text-[clamp(1.08rem,1.35vw,1.42rem)] leading-[1.58] text-[color:color-mix(in_oklab,var(--bokmoo-copy)_94%,white)] lg:mt-8">
                {site.subheadline}
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => openHref(site.primaryCtaHref)}
                  className={`inline-flex min-h-[4.15rem] items-center justify-center rounded-[1.05rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_62%,black))] px-11 text-lg font-black text-[var(--bokmoo-bg)] shadow-[0_22px_54px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {site.primaryCtaLabel}
                </button>
                <button
                  onClick={() => openHref(site.secondaryCtaHref)}
                  className={`inline-flex min-h-[4.15rem] items-center justify-center rounded-[1.05rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.045_0.006_75_/_0.66)] px-11 text-lg font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {site.secondaryCtaLabel}
                </button>
              </div>

              <div className="mt-10 grid max-w-[48rem] grid-cols-2 gap-4 xl:grid-cols-4">
                {heroBadges.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex items-start gap-4 rounded-[1.1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] bg-[color:oklch(0.058_0.007_75_/_0.68)] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018)]">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_17%,transparent)] text-[var(--bokmoo-gold)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[1.02rem] font-medium leading-tight text-[var(--bokmoo-ink)]">{title}</p>
                      <p className="mt-1 text-sm leading-tight text-[var(--bokmoo-copy-soft)]">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pointer-events-none relative mx-auto hidden h-[27rem] w-full max-w-[37rem] sm:h-[35rem] sm:max-w-[48rem] lg:mx-0 lg:block lg:h-[36rem] lg:max-w-[47rem] lg:justify-self-end xl:h-[42rem] xl:max-w-[56rem] 2xl:h-[48rem] 2xl:max-w-[64rem]">
              <div className="absolute inset-[5%_-3%_1%_2%] z-0 bg-[radial-gradient(ellipse_at_58%_52%,color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent),transparent_68%)] blur-2xl" />
              <div className="absolute bottom-[8%] left-[8%] right-[3%] h-28 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--bokmoo-gold)_70%,transparent),transparent_70%)] blur-2xl lg:h-40" />
              <div className="absolute bottom-[9%] left-[7%] right-[2%] h-36 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_54%,transparent)] opacity-80 lg:h-52" />
              <div className="absolute bottom-[3%] left-[-2%] right-[-8%] h-52 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_30%,transparent)] opacity-70 lg:h-72" />
              <img
                src={BOKMOO_HERO_CARD_SRC}
                alt="BOKMOO eUICC card"
                className="relative z-10 h-full w-full select-none object-contain object-center opacity-95 mix-blend-multiply contrast-[1.04] saturate-[0.94] [mask-image:radial-gradient(ellipse_88%_92%_at_56%_50%,black_56%,rgba(0,0,0,0.92)_72%,rgba(0,0,0,0.42)_88%,transparent_100%)] drop-shadow-[0_44px_90px_rgba(0,0,0,0.68)] lg:object-right"
                draggable={false}
              />
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018),0_22px_70px_rgba(0,0,0,0.36)] sm:rounded-full sm:px-7 sm:py-3.5 lg:mt-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4 text-sm sm:items-center sm:text-base">
                <span className="shrink-0 rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                  {isZhHant ? '公告' : 'Notice'}
                </span>
                <span className="text-[color:color-mix(in_oklab,var(--bokmoo-copy)_92%,white)]">
                  {isZhHant ? 'BOKMOO Pro eUICC 卡現已推出，輕鬆管理多個 eSIM 設定檔。' : 'BOKMOO Pro eUICC Card is now available! Manage multiple eSIM profiles with ease.'}
                </span>
              </div>
              <button
                onClick={() => openHref('/products')}
                className={`inline-flex shrink-0 items-center gap-3 rounded-full px-2 py-1 text-sm font-semibold text-[var(--bokmoo-gold)] sm:text-base ${FOCUS_VISIBLE_RING}`}
                type="button"
              >
                {isZhHant ? '瞭解更多' : 'Learn more'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px] space-y-6">
          <div id="how-it-works" className="scroll-mt-24 rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8 lg:scroll-mt-32">
            <div className="text-center">
              <h2 className="text-[clamp(2.2rem,4vw,3.4rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                {isZhHant ? '為什麼選擇 BOKMOO？' : 'Why Choose BOKMOO?'}
              </h2>
              <p className="mt-3 text-base text-[var(--bokmoo-copy)]">
                {isZhHant ? '由您全面掌控的新世代 eSIM 平台。' : 'The next generation eSIM platform that puts you in control.'}
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {reasonCards.map(({ title, body, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-[1.2rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-5 py-6"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-center text-xl font-medium text-[var(--bokmoo-ink)]">{title}</h3>
                  <p className="mt-3 text-center text-sm leading-7 text-[var(--bokmoo-copy)]">{body}</p>
                </article>
              ))}
            </div>
          </div>

          {homeProductsLoading || homeProducts.length > 0 ? (
            <div className="rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
              <div className="flex flex-col gap-4 border-b border-[var(--bokmoo-line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-[clamp(2rem,3.4vw,3rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                    {isZhHant ? 'BOKMOO 實體卡' : 'The BOKMOO Card'}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--bokmoo-copy)]">
                    {isZhHant
                      ? '與商品目錄即時同步的真實資訊——購買實體卡，落地即可啟用 eSIM 服務。'
                      : 'Live data straight from our product catalog. Buy the physical card and activate eSIM service on arrival.'}
                  </p>
                </div>

                <button
                  onClick={() => openHref('/products')}
                  className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {isZhHant ? '查看卡片與方案' : 'View card & plans'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {homeProductsLoading
                  ? [0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="h-[25rem] animate-pulse rounded-[1.25rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)]"
                      />
                    ))
                  : homeProducts.map((product) => (
                      <article
                        key={product.id}
                        className="group overflow-hidden rounded-[1.25rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1"
                      >
                        <div className="aspect-[1.6/1] overflow-hidden border-b border-[var(--bokmoo-line)] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_60%),var(--bokmoo-bg-soft)]">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[var(--bokmoo-copy-soft)]">
                              <CreditCard className="h-10 w-10" />
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-gold)]">
                              {isZhHant ? '實體卡' : 'Physical card'}
                            </span>
                            <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy)]">eUICC</span>
                          </div>
                          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[var(--bokmoo-ink)]">{product.name}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--bokmoo-copy)]">{product.description}</p>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--bokmoo-ink)]">
                              ${Number(product.price || 0).toFixed(2)}
                            </p>
                            <button
                              onClick={() => openHref('/products')}
                              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_84%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-6 text-sm font-semibold text-[var(--bokmoo-bg)] transition-transform duration-300 hover:-translate-y-0.5 ${FOCUS_VISIBLE_RING}`}
                              type="button"
                            >
                              {isZhHant ? '立即購買' : 'Buy Now'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div>
                <h2 className="text-[clamp(2rem,3.2vw,2.8rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                  {isZhHant ? '使用方式' : 'How It Works'}
                </h2>
                <div className="mt-6 grid gap-5 md:grid-cols-3">
                  {steps.map(({ title, body, icon: Icon }) => (
                    <div key={title} className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]">
                        <Icon className="h-7 w-7" />
                      </div>
                      <h3 className="mt-5 text-lg font-medium text-[var(--bokmoo-ink)]">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.25rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(160deg,#7c6244_0%,#25211c_55%,#0d0d0d_100%)] p-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_18%,rgba(255,215,138,0.4),transparent_18%),linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" />
                <div className="absolute left-10 top-12 h-5 w-5 rounded-full bg-[rgba(255,219,162,0.32)] blur-[1px]" />
                <div className="absolute left-20 top-20 h-3 w-3 rounded-full bg-[rgba(255,219,162,0.24)] blur-[1px]" />
                <div className="absolute left-[36%] top-16 h-6 w-6 rounded-full bg-[rgba(255,219,162,0.28)] blur-[1px]" />

                <div className="relative ml-auto w-[11rem] rounded-[1.05rem] border border-[rgba(255,255,255,0.14)] bg-[rgba(12,12,14,0.7)] p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid grid-cols-2 gap-0.5">
                        <span className="h-2.5 w-2.5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)]" />
                        <span className="h-2.5 w-2.5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)]" />
                        <span className="h-2.5 w-2.5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)]" />
                        <span className="h-2.5 w-2.5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)]" />
                      </div>
                      <span className="text-xs font-semibold text-[var(--bokmoo-ink)]">BOKMOO Pro</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-300">{isZhHant ? '使用中' : 'Active'}</span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] text-[var(--bokmoo-copy-soft)]">{isZhHant ? '數據用量' : 'Data Usage'}</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--bokmoo-ink)]">12.45 <span className="text-sm font-medium text-[var(--bokmoo-copy)]">GB / 20 GB</span></p>
                    <div className="mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div className="h-full w-[62%] rounded-full bg-[linear-gradient(90deg,var(--bokmoo-gold),color-mix(in_oklab,var(--bokmoo-gold)_72%,white))]" />
                    </div>
                    <p className="mt-4 text-[11px] text-[var(--bokmoo-copy-soft)]">{isZhHant ? '有效期限' : 'Valid Until'}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--bokmoo-ink)]">2025-06-30</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(135deg,#1b1610,#0c0b09_45%,#19130e)] shadow-[var(--bokmoo-shadow)]">
            <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,0.86fr)_22rem] lg:px-8">
              <div className="relative">
                <div className="absolute -bottom-28 left-[28%] h-72 w-72 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] opacity-60" />
                <div className="absolute -bottom-36 left-[24%] h-96 w-96 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] opacity-50" />

                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                  BOKMOO eUICC Card
                </p>
                <h2 className="mt-3 text-[clamp(2.2rem,4vw,3.8rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                  {isZhHant ? '一卡在手，無限可能。' : 'One Card. Unlimited Possibilities.'}
                </h2>
                <ul className="mt-6 space-y-3 text-base text-[var(--bokmoo-copy)]">
                  <li>{isZhHant ? '儲存多個 eSIM 設定檔' : 'Store multiple eSIM profiles'}</li>
                  <li>{isZhHant ? '透過 BOKMOO App 輕鬆管理' : 'Easy management via BOKMOO App'}</li>
                  <li>{isZhHant ? '相容 iOS 與 Android' : 'Compatible with iOS & Android'}</li>
                </ul>
                <button
                  onClick={() => openHref(site.secondaryCtaHref)}
                  className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_84%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-7 text-sm font-semibold text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING}`}
                  type="button"
                >
                  {isZhHant ? '立即選購' : 'Shop Now'}
                </button>
              </div>

              <div className="grid gap-4">
                {euiccFeatures.map(({ title, body, icon: Icon }) => (
                  <article
                    key={title}
                    className="rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[0.95rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-[var(--bokmoo-ink)]">{title}</h3>
                        <p className="mt-2 text-sm leading-7 text-[var(--bokmoo-copy)]">{body}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-[1.35rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="border-b border-[var(--bokmoo-line)] pb-4 last:border-none sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4 sm:last:border-r-0">
                <p className="text-[clamp(2rem,3vw,2.8rem)] font-semibold tracking-[-0.06em] text-[var(--bokmoo-ink)]">
                  {metric.value}
                </p>
                <p className="mt-1 text-sm text-[var(--bokmoo-copy-soft)]">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
});

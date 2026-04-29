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
import { isExternalHref, resolveBokmooSiteConfig } from '../site';

type PlanCategory = 'Popular' | 'Asia' | 'Europe' | 'North America' | 'Global';

type HeroPillarProps = {
  className: string;
};

type HomePlan = {
  country: string;
  allowance: string;
  speed: string;
  price: string;
  badge?: string;
  art: string;
  scene: DestinationSceneName;
};

type DestinationSceneName =
  | 'japan'
  | 'usa'
  | 'europe'
  | 'hong-kong'
  | 'thailand'
  | 'singapore'
  | 'korea'
  | 'malaysia'
  | 'uk'
  | 'italy'
  | 'canada'
  | 'mexico'
  | 'global';

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

function DestinationScene({ scene }: { scene: DestinationSceneName }) {
  const waterGradientId = React.useId().replace(/:/g, '');
  const skyByScene: Record<DestinationSceneName, string> = {
    japan: 'from-[#d77365] via-[#344d81] to-[#080b12]',
    usa: 'from-[#7390c8] via-[#34506d] to-[#07101a]',
    europe: 'from-[#d99d7a] via-[#5c4051] to-[#100d12]',
    'hong-kong': 'from-[#234f78] via-[#142c45] to-[#060910]',
    thailand: 'from-[#b9906c] via-[#56405b] to-[#09070d]',
    singapore: 'from-[#4f89a4] via-[#173b4a] to-[#071012]',
    korea: 'from-[#7b8fc9] via-[#353c65] to-[#0d0b12]',
    malaysia: 'from-[#6b8c66] via-[#2e493a] to-[#071009]',
    uk: 'from-[#7789a5] via-[#333c4c] to-[#0c0d12]',
    italy: 'from-[#d49b72] via-[#634034] to-[#100c0b]',
    canada: 'from-[#8598af] via-[#394b5d] to-[#0a0d11]',
    mexico: 'from-[#b18a58] via-[#514028] to-[#100c09]',
    global: 'from-[#80613b] via-[#292019] to-[#070605]',
  };

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${skyByScene[scene]}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_16%,rgba(255,210,132,0.58),transparent_15%),radial-gradient(circle_at_70%_12%,rgba(255,196,104,0.2),transparent_22%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 260" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={waterGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d="M0 206 C78 184 143 197 202 182 C276 162 338 174 420 150 L420 260 L0 260 Z" fill="rgba(4,5,8,0.58)" />
        <path d="M0 220 C82 204 160 212 232 198 C306 184 362 194 420 178" fill="none" stroke={`url(#${waterGradientId})`} strokeWidth="2" />
        {scene === 'japan' ? (
          <>
            <path d="M230 172 L285 80 L344 172 Z" fill="rgba(248,238,220,0.78)" />
            <path d="M250 172 L285 112 L322 172 Z" fill="rgba(82,102,142,0.7)" />
            <g fill="rgba(29,16,15,0.88)">
              <path d="M42 118 L112 118 L98 132 L56 132 Z" />
              <rect x="58" y="132" width="38" height="44" rx="2" />
              <path d="M46 152 L108 152 L96 164 L58 164 Z" />
              <rect x="63" y="164" width="28" height="44" rx="2" />
            </g>
          </>
        ) : null}
        {scene === 'usa' ? (
          <g fill="rgba(215,225,218,0.74)">
            <path d="M102 74 L122 74 L126 188 L98 188 Z" />
            <path d="M92 190 L132 190 L142 218 L82 218 Z" />
            <path d="M105 62 L119 42 L129 62 Z" />
            <path d="M123 100 L162 86 L164 100 L125 116 Z" />
          </g>
        ) : null}
        {scene === 'europe' ? (
          <g fill="rgba(33,22,24,0.78)" stroke="rgba(246,203,126,0.2)" strokeWidth="2">
            <path d="M214 54 L244 218 L186 218 Z" />
            <path d="M198 118 L234 118 L248 142 L184 142 Z" />
            <path d="M188 178 L246 178 L262 218 L172 218 Z" />
          </g>
        ) : null}
        {scene === 'hong-kong' || scene === 'singapore' ? (
          <g fill="rgba(12,14,20,0.9)">
            <rect x="36" y="134" width="34" height="84" rx="3" />
            <rect x="82" y="104" width="42" height="114" rx="3" />
            <rect x="142" y="128" width="48" height="90" rx="3" />
            <rect x="214" y="84" width="36" height="134" rx="3" />
            <rect x="272" y="116" width="54" height="102" rx="3" />
            <rect x="342" y="96" width="32" height="122" rx="3" />
          </g>
        ) : null}
        {scene === 'thailand' ? (
          <g fill="rgba(38,23,16,0.86)" stroke="rgba(244,203,111,0.2)" strokeWidth="2">
            <path d="M82 110 L118 72 L154 110 Z" />
            <rect x="94" y="110" width="48" height="82" rx="3" />
            <path d="M184 124 L222 78 L260 124 Z" />
            <rect x="198" y="124" width="48" height="76" rx="3" />
            <path d="M288 132 L324 90 L360 132 Z" />
            <rect x="302" y="132" width="44" height="68" rx="3" />
          </g>
        ) : null}
        {['korea', 'malaysia', 'uk', 'italy', 'canada', 'mexico', 'global'].includes(scene) ? (
          <g fill="rgba(14,16,18,0.82)">
            <path d="M0 190 C60 140 102 164 148 126 C196 88 255 132 306 96 C354 66 382 98 420 76 L420 260 L0 260 Z" />
            <path d="M82 138 L118 106 L154 138 Z" fill="rgba(237,202,132,0.12)" />
            <path d="M260 122 L296 80 L332 122 Z" fill="rgba(237,202,132,0.14)" />
          </g>
        ) : null}
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,8,0.02),rgba(4,5,8,0.42)_58%,rgba(4,5,8,0.78))]" />
    </div>
  );
}

function PlanCard({
  plan,
  onClick,
}: {
  plan: HomePlan;
  onClick: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] shadow-[var(--bokmoo-shadow)]">
      <div className={`relative aspect-[1.28/0.76] overflow-hidden border-b border-[var(--bokmoo-line)] ${plan.art}`}>
        <DestinationScene scene={plan.scene} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(6,6,7,0.08)_48%,rgba(6,6,7,0.7))]" />
        {plan.badge ? (
          <span className="absolute left-3 top-3 inline-flex rounded-full bg-[var(--bokmoo-gold)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]">
            {plan.badge}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-2xl font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">{plan.country}</p>
          <p className="mt-1 text-sm text-[color:color-mix(in_oklab,var(--bokmoo-copy)_88%,white)]">{plan.allowance}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--bokmoo-copy-soft)]">{plan.speed}</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[1.85rem] font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]">
              {plan.price}
            </p>
            <p className="text-xs text-[var(--bokmoo-copy-soft)]">Best-value travel bundle</p>
          </div>
          <button
            onClick={onClick}
            className="inline-flex min-h-11 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_66%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] transition-transform duration-300 group-hover:-translate-y-0.5"
            type="button"
          >
            Buy Now
          </button>
        </div>
      </div>
    </article>
  );
}

export const HomePage = React.memo(function HomePage({ config, onNavigate }: HomePageProps) {
  const site = resolveBokmooSiteConfig(config);
  const [activeCategory, setActiveCategory] = React.useState<PlanCategory>('Popular');

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      onNavigate?.(href);
    },
    [onNavigate]
  );

  const planDecks = React.useMemo<Record<PlanCategory, HomePlan[]>>(
    () => ({
      Popular: [
        {
          country: 'Japan',
          allowance: '10GB / 7 Days',
          speed: '4G/5G High Speed',
          price: '$12.00',
          badge: 'Hot',
          art: 'bg-[linear-gradient(160deg,#93a4db_0%,#4d6d9f_45%,#11151e_100%)]',
          scene: 'japan',
        },
        {
          country: 'United States',
          allowance: '20GB / 15 Days',
          speed: '4G/5G High Speed',
          price: '$19.00',
          art: 'bg-[linear-gradient(160deg,#5878a7_0%,#2e425b_48%,#0e1117_100%)]',
          scene: 'usa',
        },
        {
          country: 'Europe',
          allowance: '10GB / 15 Days',
          speed: '4G/5G High Speed',
          price: '$18.50',
          art: 'bg-[linear-gradient(160deg,#d09c8c_0%,#7a5160_46%,#161116_100%)]',
          scene: 'europe',
        },
        {
          country: 'Hong Kong',
          allowance: '5GB / 7 Days',
          speed: '4G/5G High Speed',
          price: '$8.50',
          art: 'bg-[linear-gradient(160deg,#355a80_0%,#1f3347_54%,#0c1018_100%)]',
          scene: 'hong-kong',
        },
        {
          country: 'Thailand',
          allowance: '15GB / 10 Days',
          speed: '4G/5G High Speed',
          price: '$11.00',
          art: 'bg-[linear-gradient(160deg,#8579b6_0%,#4e3953_56%,#110f16_100%)]',
          scene: 'thailand',
        },
      ],
      Asia: [
        {
          country: 'Singapore',
          allowance: '8GB / 7 Days',
          speed: '4G/5G High Speed',
          price: '$9.50',
          art: 'bg-[linear-gradient(160deg,#4d7485_0%,#233642_56%,#0d1114_100%)]',
          scene: 'singapore',
        },
        {
          country: 'Korea',
          allowance: '12GB / 10 Days',
          speed: '4G/5G High Speed',
          price: '$10.50',
          art: 'bg-[linear-gradient(160deg,#6c80b5_0%,#2d3451_56%,#110f14_100%)]',
          scene: 'korea',
        },
        {
          country: 'Malaysia',
          allowance: '10GB / 8 Days',
          speed: '4G/5G High Speed',
          price: '$8.00',
          art: 'bg-[linear-gradient(160deg,#54705f_0%,#243129_56%,#0f1310_100%)]',
          scene: 'malaysia',
        },
      ],
      Europe: [
        {
          country: 'Europe 33',
          allowance: '20GB / 30 Days',
          speed: '4G/5G High Speed',
          price: '$24.00',
          badge: 'Best',
          art: 'bg-[linear-gradient(160deg,#cb977f_0%,#67484b_52%,#151013_100%)]',
          scene: 'europe',
        },
        {
          country: 'United Kingdom',
          allowance: '12GB / 14 Days',
          speed: '4G/5G High Speed',
          price: '$15.00',
          art: 'bg-[linear-gradient(160deg,#7181a1_0%,#323947_54%,#131216_100%)]',
          scene: 'uk',
        },
        {
          country: 'Italy',
          allowance: '10GB / 10 Days',
          speed: '4G/5G High Speed',
          price: '$13.50',
          art: 'bg-[linear-gradient(160deg,#9d6d59_0%,#49322e_54%,#140f10_100%)]',
          scene: 'italy',
        },
      ],
      'North America': [
        {
          country: 'United States',
          allowance: '20GB / 15 Days',
          speed: '4G/5G High Speed',
          price: '$19.00',
          art: 'bg-[linear-gradient(160deg,#5878a7_0%,#2e425b_48%,#0e1117_100%)]',
          scene: 'usa',
        },
        {
          country: 'Canada',
          allowance: '12GB / 15 Days',
          speed: '4G/5G High Speed',
          price: '$16.00',
          art: 'bg-[linear-gradient(160deg,#7c8ca7_0%,#353d4d_52%,#121419_100%)]',
          scene: 'canada',
        },
        {
          country: 'Mexico',
          allowance: '8GB / 7 Days',
          speed: '4G/5G High Speed',
          price: '$9.00',
          art: 'bg-[linear-gradient(160deg,#7b6f59_0%,#42392a_54%,#15120f_100%)]',
          scene: 'mexico',
        },
      ],
      Global: [
        {
          country: 'Global Pass',
          allowance: '25GB / 30 Days',
          speed: 'Priority Multi-Network',
          price: '$39.00',
          badge: 'Pro',
          art: 'bg-[linear-gradient(160deg,#6e5d3f_0%,#2a231a_48%,#0e0d0b_100%)]',
          scene: 'global',
        },
        {
          country: 'Business Global',
          allowance: '50GB / 45 Days',
          speed: 'Priority Multi-Network',
          price: '$69.00',
          art: 'bg-[linear-gradient(160deg,#4b3f6c_0%,#241d33_50%,#0f0d13_100%)]',
          scene: 'global',
        },
      ],
    }),
    []
  );

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

  const activePlans = planDecks[activeCategory];
  const heroTitleLines = ['One Card.', 'Global', 'Connection.'];

  return (
    <div className="bg-[var(--bokmoo-bg)] text-[var(--bokmoo-ink)]">
      <section className="relative overflow-hidden border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] px-5 pb-12 pt-12 sm:px-8 lg:min-h-[calc(100vh-5.25rem)] lg:px-10 lg:pb-8 lg:pt-14 xl:min-h-[calc(100vh-6.75rem)] xl:pt-16 2xl:pt-[4.5rem]">
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

        <div className="relative mx-auto flex w-full max-w-[1880px] flex-col lg:min-h-[calc(100vh-13.25rem)] xl:min-h-[calc(100vh-14.75rem)]">
          <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(25rem,0.62fr)_minmax(32rem,1.38fr)] lg:items-center xl:grid-cols-[minmax(0,0.58fr)_minmax(44rem,1.42fr)] 2xl:grid-cols-[minmax(0,0.54fr)_minmax(52rem,1.46fr)]">
            <div className="max-w-[62rem] pt-2 lg:-ml-1 xl:-ml-2">
              <div className="inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.7)] px-5 py-2.5 text-[0.78rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025)]">
                <Sparkles className="h-4 w-4" />
                {site.eyebrow}
              </div>

              <h1 className="mt-8 max-w-[9.7ch] text-[clamp(3.2rem,13.6vw,5.2rem)] font-black leading-[0.82] tracking-[-0.105em] text-[color:oklch(0.985_0.004_86)] sm:max-w-[10.4ch] lg:mt-9 lg:text-[clamp(5.55rem,7.5vw,8rem)] xl:text-[clamp(7.35rem,8.25vw,12.6rem)] 2xl:text-[clamp(8.35rem,7.7vw,13.25rem)]">
                {heroTitleLines.map((line) => (
                  <span key={line} className="block whitespace-nowrap">
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
                  className="inline-flex min-h-[4.15rem] items-center justify-center rounded-[1.05rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_62%,black))] px-11 text-lg font-black text-[var(--bokmoo-bg)] shadow-[0_22px_54px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] transition-transform duration-300 hover:-translate-y-0.5"
                  type="button"
                >
                  {site.primaryCtaLabel}
                </button>
                <button
                  onClick={() => openHref(site.secondaryCtaHref)}
                  className="inline-flex min-h-[4.15rem] items-center justify-center rounded-[1.05rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.045_0.006_75_/_0.66)] px-11 text-lg font-medium text-[var(--bokmoo-ink)]"
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

            <div className="relative mx-auto h-[32rem] w-full max-w-[36rem] sm:h-[38rem] sm:max-w-[48rem] lg:mx-0 lg:h-[39rem] lg:max-w-none lg:translate-x-20 lg:rotate-[4deg] lg:scale-[1.02] xl:h-[45rem] xl:-mr-[8rem] xl:translate-x-24 xl:scale-[1.08] 2xl:h-[50rem] 2xl:-mr-[12rem] 2xl:translate-x-32 2xl:scale-[1.12]">
              <div className="absolute bottom-[1%] left-[2%] right-[-18%] h-32 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--bokmoo-gold)_72%,transparent),transparent_68%)] blur-2xl lg:h-40" />
              <div className="absolute bottom-[4%] left-[2%] right-[-18%] h-44 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_64%,transparent)] lg:h-56" />
              <div className="absolute bottom-[-3%] left-[-8%] right-[-24%] h-64 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_34%,transparent)] lg:h-80" />
              <div className="absolute right-[3%] top-[4%] h-[78%] w-[34%] rotate-[5deg] rounded-[2.4rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.026))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045),0_54px_160px_rgba(0,0,0,0.72)] sm:rounded-[2.8rem] xl:right-[8%]" />
              <div className="absolute right-[7%] top-[8%] h-[69%] w-[28%] rotate-[5deg] rounded-[2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_31%,transparent)] bg-[linear-gradient(180deg,#1b1813_0%,#070707_78%)] shadow-[inset_0_22px_42px_rgba(255,255,255,0.03)] sm:rounded-[2.35rem] xl:right-[12%]" />
              <div className="absolute right-[15%] top-[19%] h-[4.8rem] w-[4.8rem] rotate-[5deg] rounded-[1.15rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.13),rgba(255,255,255,0.03))] shadow-[inset_0_20px_30px_rgba(255,255,255,0.03),0_24px_54px_rgba(0,0,0,0.38)] sm:h-[5.8rem] sm:w-[5.8rem] xl:right-[20%] xl:h-[7rem] xl:w-[7rem]" />
              <div className="absolute right-[16%] top-[34%] h-[4.8rem] w-[4.8rem] rotate-[5deg] rounded-[1.15rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.024))] shadow-[inset_0_20px_30px_rgba(255,255,255,0.026),0_24px_54px_rgba(0,0,0,0.34)] sm:h-[5.8rem] sm:w-[5.8rem] xl:right-[21%] xl:h-[7rem] xl:w-[7rem]" />

              <div className="absolute bottom-[8%] left-[11%] z-10 h-[84%] w-[58%] -rotate-[12deg] rounded-[2.25rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_56%,transparent)] bg-[radial-gradient(circle_at_35%_14%,rgba(255,226,160,0.16),transparent_31%),linear-gradient(180deg,#1d1814_0%,#080706_78%)] shadow-[0_64px_180px_rgba(0,0,0,0.82),inset_0_0_0_1px_rgba(255,255,255,0.035)] sm:left-[18%] sm:w-[48%] sm:rounded-[2.75rem] lg:left-[7%] lg:h-[88%] lg:w-[50%] xl:left-[5%]">
                <div className="absolute left-[11%] top-[8.5%] flex items-center gap-3.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <span className="h-5 w-5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)] xl:h-6 xl:w-6" />
                    <span className="h-5 w-5 rounded-tl-[999px] rounded-tr-[999px] bg-[var(--bokmoo-gold)] xl:h-6 xl:w-6" />
                    <span className="h-5 w-5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)] xl:h-6 xl:w-6" />
                    <span className="h-5 w-5 rounded-bl-[999px] rounded-br-[999px] bg-[var(--bokmoo-gold)] xl:h-6 xl:w-6" />
                  </div>
                  <span className="text-base font-semibold uppercase tracking-[0.16em] text-[var(--bokmoo-gold)] xl:text-lg">
                    BOKMOO
                  </span>
                </div>

                <div className="absolute left-1/2 top-[34%] h-[9.25rem] w-[9.25rem] -translate-x-1/2 -translate-y-1/2 rounded-[1.55rem] border border-[var(--bokmoo-line-strong)] bg-[radial-gradient(circle_at_50%_52%,rgba(220,172,76,0.18),transparent_36%),linear-gradient(180deg,#121110,#17120e)] shadow-[0_22px_58px_rgba(0,0,0,0.55)] sm:h-[13.4rem] sm:w-[13.4rem] sm:rounded-[1.9rem] xl:h-[19rem] xl:w-[19rem] xl:rounded-[2.5rem]">
                  <div className="absolute inset-x-5 inset-y-6 rounded-[1.15rem] border border-[var(--bokmoo-line)] sm:inset-x-7 sm:inset-y-8 sm:rounded-[1.55rem] xl:inset-x-9 xl:inset-y-10 xl:rounded-[1.9rem]" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-[0.9rem] bg-[linear-gradient(145deg,#f2d990,#b98739)] shadow-[0_18px_36px_rgba(215,178,61,0.32)] sm:h-24 sm:w-36 sm:rounded-[1.1rem] xl:h-32 xl:w-48 xl:rounded-[1.35rem]" />
                </div>

                <p className="absolute bottom-[22%] left-[13%] max-w-[10rem] text-[1.08rem] leading-[1.18] tracking-[0.12em] text-[var(--bokmoo-gold)] sm:max-w-[13rem] sm:text-[1.55rem] xl:max-w-[17rem] xl:text-[2.1rem]">
                  YOUR GLOBAL PARTNER.
                </p>
                <p className="absolute bottom-[7%] left-[13%] text-xs tracking-[0.26em] text-[var(--bokmoo-copy-soft)] sm:text-sm xl:text-base">
                  BOKMOO.COM
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.018),0_22px_70px_rgba(0,0,0,0.36)] sm:rounded-full sm:px-7 sm:py-3.5 lg:mt-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4 text-sm sm:items-center sm:text-base">
                <span className="shrink-0 rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                  Notice
                </span>
                <span className="text-[color:color-mix(in_oklab,var(--bokmoo-copy)_92%,white)]">
                  BOKMOO Pro eUICC Card is now available! Manage multiple eSIM profiles with ease.
                </span>
              </div>
              <button
                onClick={() => openHref('/products')}
                className="inline-flex shrink-0 items-center gap-3 text-sm font-semibold text-[var(--bokmoo-gold)] sm:text-base"
                type="button"
              >
                Learn more
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px] space-y-6">
          <div id="how-it-works" className="rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="text-center">
              <h2 className="text-[clamp(2.2rem,4vw,3.4rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                Why Choose BOKMOO?
              </h2>
              <p className="mt-3 text-base text-[var(--bokmoo-copy)]">
                The next generation eSIM platform that puts you in control.
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

          <div className="rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="flex flex-col gap-4 border-b border-[var(--bokmoo-line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[clamp(2rem,3.4vw,3rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                  eSIM Plans for Every Journey
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    ['Popular', 'Asia', 'Europe', 'North America', 'Global'] as PlanCategory[]
                  ).map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`rounded-full px-4 py-2 text-sm transition-colors ${
                        activeCategory === category
                          ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]'
                          : 'text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]'
                      }`}
                      type="button"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => openHref('/products')}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--bokmoo-gold)]"
                type="button"
              >
                View all plans
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-5">
              {activePlans.map((plan) => (
                <PlanCard key={`${activeCategory}-${plan.country}`} plan={plan} onClick={() => openHref('/products')} />
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div>
                <h2 className="text-[clamp(2rem,3.2vw,2.8rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                  How It Works
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
                    <span className="text-[10px] font-semibold text-emerald-300">Active</span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] text-[var(--bokmoo-copy-soft)]">Data Usage</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--bokmoo-ink)]">12.45 <span className="text-sm font-medium text-[var(--bokmoo-copy)]">GB / 20 GB</span></p>
                    <div className="mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div className="h-full w-[62%] rounded-full bg-[linear-gradient(90deg,var(--bokmoo-gold),color-mix(in_oklab,var(--bokmoo-gold)_72%,white))]" />
                    </div>
                    <p className="mt-4 text-[11px] text-[var(--bokmoo-copy-soft)]">Valid Until</p>
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
                  One Card. Unlimited Possibilities.
                </h2>
                <ul className="mt-6 space-y-3 text-base text-[var(--bokmoo-copy)]">
                  <li>Store multiple eSIM profiles</li>
                  <li>Easy management via BOKMOO App</li>
                  <li>Compatible with iOS & Android</li>
                </ul>
                <button
                  onClick={() => openHref(site.secondaryCtaHref)}
                  className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_84%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-7 text-sm font-semibold text-[var(--bokmoo-bg)]"
                  type="button"
                >
                  Shop Now
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

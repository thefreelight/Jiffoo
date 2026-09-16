import React from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, Flame, Search, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { categoryIconMap, HeroArch, Rating, ToolLogo } from './design-primitives';

const categoryAccentClass: Record<string, string> = {
  blue: 'bg-[#e7f0ff] text-[#2f6bff]',
  purple: 'bg-[#efeaff] text-[#7c5cff]',
  orange: 'bg-[#fff0e6] text-[#ff7a33]',
  teal: 'bg-[#e6fbf5] text-[#12b189]',
  yellow: 'bg-[#fff6dc] text-[#d99a12]',
  slate: 'bg-[#f1f4fb] text-[#667088]',
  pink: 'bg-[#ffeef5] text-[#e0559a]',
  green: 'bg-[#e8f8ee] text-[#22a35a]',
};

// Locale-independent catalogue metrics (brand data, not translated copy).
const categoryToolCounts = ['1000+', '800+', '500+', '600+', '700+', '400+', '300+', ''];
const featuredUsers: Record<string, string> = {
  chatgpt: '100M+',
  midjourney: '20M+',
  claude: '10M+',
  'notion ai': '10M+',
  runway: '5M+',
  perplexity: '10M+',
  cursor: '8M+',
  gemini: '15M+',
  sora: '3M+',
};

interface TrendingEntry {
  name: string;
  heat: string;
  tagline: Record<'en' | 'zh-Hans' | 'zh-Hant', string>;
}

const trendingTools: TrendingEntry[] = [
  { name: 'Sora', heat: '12.4K', tagline: { en: 'AI video generation by OpenAI', 'zh-Hans': 'OpenAI 的 AI 视频生成', 'zh-Hant': 'OpenAI 的 AI 影片生成' } },
  { name: 'Lovable', heat: '8.9K', tagline: { en: 'Build products with natural language', 'zh-Hans': '用自然语言构建产品', 'zh-Hant': '用自然語言建構產品' } },
  { name: 'Cursor', heat: '7.6K', tagline: { en: 'The AI code editor', 'zh-Hans': 'AI 代码编辑器', 'zh-Hant': 'AI 程式碼編輯器' } },
  { name: 'Suno', heat: '6.8K', tagline: { en: 'AI music for everyone', 'zh-Hans': '人人都能用的 AI 音乐', 'zh-Hant': '人人都能用的 AI 音樂' } },
  { name: 'ElevenLabs', heat: '6.1K', tagline: { en: 'Realistic AI voice generation', 'zh-Hans': '逼真自然的 AI 语音生成', 'zh-Hant': '逼真自然的 AI 語音生成' } },
];

function heroTitle(title: string) {
  const marker = 'AI';
  const index = title.indexOf(marker);
  if (index < 0) return title;
  return (
    <>
      {title.slice(0, index)}
      <span className="text-[#2f6bff]">{marker}</span>
      {title.slice(index + marker.length)}
    </>
  );
}

function SectionHead({
  icon,
  title,
  sub,
  action,
  onAction,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-[1.4rem] font-black tracking-tight text-[#0f1730]">
          {icon}
          {title}
        </h2>
        {sub ? <p className="mt-1 text-sm font-medium text-[#6b768e]">{sub}</p> : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 text-sm font-bold text-[#2f6bff] transition-colors hover:text-[#1f4fd0]"
        >
          {action}
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export const HomePage = React.memo(function HomePage({ locale, onNavigate }: HomePageProps) {
  const [query, setQuery] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [subscribed, setSubscribed] = React.useState(false);
  const copy = getNavCopy(locale);
  const landing = copy.landing;
  const lang = copy.locale;

  const navigateTo = React.useCallback(
    (href: string) => {
      if (onNavigate) {
        onNavigate(href);
        return;
      }
      if (typeof window !== 'undefined') window.location.assign(href);
    },
    [onNavigate],
  );

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigateTo(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const submitSubscribe = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  };

  return (
    <MarketplaceFrame locale={locale} onNavigate={onNavigate}>
      {/* Hero */}
      <section className="relative mt-2 overflow-hidden rounded-[1.6rem] bg-[linear-gradient(120deg,#f4f8ff_0%,#eef3ff_46%,#e7eefc_100%)]">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="px-6 pb-10 pt-10 sm:px-10 lg:py-16">
            <button
              type="button"
              onClick={() => navigateTo('/products')}
              className="inline-flex items-center gap-2 rounded-full border border-[#d6e4ff] bg-white/70 px-3.5 py-1.5 text-xs font-bold text-[#2f6bff]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
              {landing.heroEyebrow}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            <h1 className="mt-6 max-w-[15ch] text-[clamp(2.6rem,6vw,4.6rem)] font-black leading-[0.98] tracking-[-0.03em] text-[#0f1730]">
              {heroTitle(landing.heroTitle)}
            </h1>
            <p className="mt-5 max-w-[34rem] text-[1.02rem] leading-8 text-[#4a5670]">{landing.heroSubtitle}</p>

            <form onSubmit={submitSearch} className="mt-8 max-w-[34rem]">
              <div className="flex h-14 items-center gap-2 rounded-[1rem] border border-[#e4ebf7] bg-white p-2 shadow-[0_24px_48px_-30px_rgba(28,54,120,0.4)]">
                <Search className="ml-2 h-5 w-5 shrink-0 text-[#9aa6bd]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.common.searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#0f1730] outline-none placeholder:text-[#9aa6bd]"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-[0.7rem] bg-[#2f6bff] px-6 text-sm font-bold text-white transition-colors hover:bg-[#1f57e8]"
                >
                  {copy.common.search}
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#6b768e]">{landing.popularSearches}</span>
              {copy.quickSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => navigateTo(`/search?q=${encodeURIComponent(term)}`)}
                  className="rounded-full border border-[#dde6f5] bg-white/70 px-3 py-1 text-xs font-semibold text-[#3d4a63] transition-colors hover:border-[#2f6bff] hover:text-[#2f6bff]"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden h-full min-h-[26rem] lg:block">
            <HeroArch locale={lang} />
          </div>
        </div>
      </section>

      {/* Category grid */}
      <section className="mt-12 lg:mt-16">
        <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-4 xl:grid-cols-8">
          {copy.categoryCards.map((category, index) => {
            const Icon = categoryIconMap[index] || categoryIconMap[categoryIconMap.length - 1];
            const count = categoryToolCounts[index];
            return (
              <button
                key={category.title}
                type="button"
                onClick={() => navigateTo(category.href)}
                className="group flex flex-col items-center text-center"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-[1rem] ${categoryAccentClass[category.accent] || categoryAccentClass.blue} transition-transform group-hover:-translate-y-0.5`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="mt-3 text-sm font-black text-[#0f1730]">{category.title}</span>
                <span className="mt-0.5 text-xs font-medium text-[#8a93a8]">
                  {count ? `${count} ${landing.toolsCountSuffix}` : landing.exploreAll}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured tools */}
      <section className="mt-14">
        <SectionHead
          icon={<Sparkles className="h-5 w-5 text-[#2f6bff]" />}
          title={landing.featuredTitle}
          sub={landing.featuredSub}
          action={landing.viewAllTools}
          onAction={() => navigateTo('/products')}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {copy.featuredProjects.map((project) => (
            <article
              key={project.name}
              className="group flex flex-col rounded-[1.1rem] border border-[#eaeff8] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(28,54,120,0.35)] transition-shadow hover:shadow-[0_28px_54px_-30px_rgba(28,54,120,0.45)]"
            >
              <div className="flex items-start justify-between">
                <ToolLogo name={project.name} size="lg" />
                <ArrowUpRight className="h-4 w-4 text-[#b3bdce] transition-colors group-hover:text-[#2f6bff]" />
              </div>
              <h3 className="mt-4 text-base font-black text-[#0f1730]">{project.name}</h3>
              <p className="mt-2 flex-1 text-[0.82rem] leading-6 text-[#6b768e]">{project.description}</p>
              <span className="mt-3 inline-flex w-fit rounded-full bg-[#f1f5fc] px-2.5 py-1 text-[0.68rem] font-bold text-[#4a5670]">
                {project.tags[0]}
              </span>
              <div className="mt-4 flex items-center justify-between border-t border-[#f0f3f9] pt-3">
                <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-[#8a93a8]">
                  <Users className="h-3.5 w-3.5" />
                  {featuredUsers[project.name.toLowerCase()] || '1M+'} {landing.usersSuffix}
                </span>
                <Rating value={project.rating} compact />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Subscribe band */}
      <section className="mt-14 overflow-hidden rounded-[1.6rem] border border-[#e4ebf7] bg-[linear-gradient(120deg,#eef3ff_0%,#f3f0ff_100%)] p-8 sm:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f6bff]">{landing.subscribeEyebrow}</p>
            <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-black tracking-tight text-[#0f1730]">
              {heroTitle(landing.subscribeTitle)}
            </h2>
            <p className="mt-3 text-sm font-medium text-[#5a6580]">{landing.subscribeSub}</p>
          </div>
          <div>
            {subscribed ? (
              <p className="inline-flex items-center gap-2 rounded-[1rem] bg-white px-5 py-4 text-sm font-bold text-[#12b189] shadow-[0_18px_40px_-30px_rgba(28,54,120,0.4)]">
                <CheckCircle2 className="h-5 w-5" />
                {copy.locale === 'en' ? 'Subscribed! Check your inbox.' : copy.locale === 'zh-Hant' ? '訂閱成功，請查看信箱！' : '订阅成功，请查看邮箱！'}
              </p>
            ) : (
              <form onSubmit={submitSubscribe} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={landing.subscribePlaceholder}
                  className="min-w-0 flex-1 rounded-[0.8rem] border border-[#dce4f2] bg-white px-4 py-3 text-sm font-medium text-[#0f1730] outline-none placeholder:text-[#9aa6bd] focus:border-[#2f6bff]"
                />
                <button
                  type="submit"
                  className="inline-flex h-[46px] items-center justify-center rounded-[0.8rem] bg-[#2f6bff] px-6 text-sm font-bold text-white transition-colors hover:bg-[#1f57e8]"
                >
                  {landing.subscribeCta}
                </button>
              </form>
            )}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {landing.subscribePerks.map((perk) => (
                <span key={perk} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4a5670]">
                  <CheckCircle2 className="h-4 w-4 text-[#2f6bff]" />
                  {perk}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="mt-14">
        <SectionHead
          icon={<TrendingUp className="h-5 w-5 text-[#2f6bff]" />}
          title={landing.trendingTitle}
          sub={landing.trendingSub}
          action={landing.viewTrending}
          onAction={() => navigateTo('/bestsellers')}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {trendingTools.map((tool, index) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => navigateTo(`/search?q=${encodeURIComponent(tool.name)}`)}
              className="flex items-start gap-3 rounded-[1.1rem] border border-[#eaeff8] bg-white p-4 text-left shadow-[0_18px_40px_-34px_rgba(28,54,120,0.35)] transition-shadow hover:shadow-[0_26px_50px_-30px_rgba(28,54,120,0.45)]"
            >
              <span className="text-sm font-black text-[#b3bdce]">{index + 1}</span>
              <ToolLogo name={tool.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-[#0f1730]">{tool.name}</span>
                <span className="mt-0.5 block truncate text-xs font-medium text-[#8a93a8]">{tool.tagline[lang]}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#ff6a3d]">
                  <Flame className="h-3.5 w-3.5" />
                  {tool.heat}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </MarketplaceFrame>
  );
});

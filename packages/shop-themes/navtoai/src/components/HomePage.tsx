import React from 'react';
import { ArrowRight, Search } from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { categoryIconMap, HeroAiDevice, Rating, ToolLogo } from './design-primitives';

const categoryAccentClass: Record<string, string> = {
  blue: 'bg-[#eef5ff] text-[#3c78ff]',
  purple: 'bg-[#f0edff] text-[#6257ff]',
  orange: 'bg-[#fff1e8] text-[#ff7a33]',
  teal: 'bg-[#e9fbf7] text-[#17a88d]',
  yellow: 'bg-[#fff6dc] text-[#cf9412]',
  slate: 'bg-[#f2f4fb] text-[#667088]',
};

const tagAccentClass: Record<string, string> = {
  blue: 'bg-[#eff4ff] text-[#4e67e8]',
  purple: 'bg-[#f1edff] text-[#6b57f3]',
  orange: 'bg-[#fff1e8] text-[#eb7734]',
  teal: 'bg-[#e9fbf7] text-[#16a188]',
  yellow: 'bg-[#fff6dc] text-[#bf8d19]',
  pink: 'bg-[#fff0f7] text-[#cc4f89]',
};

function splitAiTitle(title: string) {
  const marker = 'AI';
  const index = title.indexOf(marker);
  if (index < 0) return title;
  return (
    <>
      {title.slice(0, index)}
      <span className="text-[#6257ff]">{marker}</span>
      {title.slice(index + marker.length)}
    </>
  );
}

function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-[1.25rem] font-black text-[#11162b]">{title}</h2>
      {action ? (
        <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-sm font-bold text-[#6257ff]">
          {action}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export const HomePage = React.memo(function HomePage({ locale, onNavigate }: HomePageProps) {
  const [query, setQuery] = React.useState('');
  const copy = getNavCopy(locale);
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

  return (
    <MarketplaceFrame activeItem="home" locale={locale} onNavigate={onNavigate}>
      <div className="lg:hidden">
        <section className="px-1 pb-5 pt-7">
          <h1 className="max-w-[20rem] text-[2.25rem] font-black leading-tight text-[#11162b]">
            {splitAiTitle(copy.home.title)}
          </h1>
          <p className="mt-3 max-w-[20rem] text-base font-medium leading-7 text-[#7a8499]">{copy.home.subtitle}</p>

          <form onSubmit={submitSearch} className="mt-7">
            <div className="flex h-14 items-center rounded-[0.9rem] border border-[#dcd9ff] bg-white px-4 shadow-[0_16px_32px_-28px_rgba(65,72,118,0.42)]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.home.heroSearchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#11162b] outline-none placeholder:text-[#a0a7b8]"
              />
              <span className="mx-3 h-6 w-px bg-[#edf0f8]" />
              <button type="submit" className="text-[#7c7890]" aria-label={copy.common.search}>
                <Search className="h-5 w-5" />
              </button>
            </div>
          </form>

          <div className="mt-5">
            <div className="text-xs font-semibold text-[#414a61]">{copy.home.hotSearches}:</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {copy.quickSearches.slice(0, 5).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => navigateTo(`/search?q=${encodeURIComponent(term)}`)}
                  className="rounded-full bg-[#f5f6fb] px-3 py-1.5 text-xs font-semibold text-[#4c556b]"
                >
                  {term}
                </button>
              ))}
              <button type="button" onClick={() => navigateTo('/products')} className="rounded-full bg-[#f5f6fb] px-3 py-1.5 text-xs font-semibold text-[#4c556b]">
                ...
              </button>
            </div>
          </div>
        </section>

        <section className="border-t border-[#edf0f8] px-1 py-6">
          <SectionTitle title={copy.home.categorySection} action={copy.common.browseAll} onAction={() => navigateTo('/categories')} />
          <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-6">
            {copy.categoryCards.slice(0, 6).map((category, index) => {
              const Icon = categoryIconMap[index] || categoryIconMap[5];
              return (
                <button key={category.title} type="button" onClick={() => navigateTo(category.href)} className="text-center">
                  <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-[0.9rem] ${categoryAccentClass[category.accent]}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="mt-3 block text-sm font-black text-[#11162b]">{category.title}</span>
                  <span className="mt-1 block text-xs font-medium text-[#8a93a8]">{category.description.split(/[,.。]/)[0]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="border-t border-[#edf0f8] px-1 py-6">
          <SectionTitle title={`🔥 ${copy.home.featuredSection}`} action={copy.common.browseAll} onAction={() => navigateTo('/products')} />
          <div className="mt-4 grid gap-3">
            {copy.featuredProjects.slice(0, 4).map((project) => (
              <button
                key={project.name}
                type="button"
                onClick={() => navigateTo(`/search?q=${encodeURIComponent(project.name)}`)}
                className="rounded-[0.95rem] border border-[#edf0f8] bg-white p-4 text-left shadow-[0_12px_28px_-24px_rgba(25,31,68,0.3)]"
              >
                <div className="flex items-start gap-3">
                  <ToolLogo name={project.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-[#11162b]">{project.name}</h3>
                        <p className="mt-0.5 text-xs font-semibold text-[#8992a7]">{project.vendor}</p>
                      </div>
                      <Rating value={project.rating} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#667086]">{project.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#f0f2ff] px-2.5 py-1 text-[0.68rem] font-bold text-[#6257ff]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="border-t border-[#edf0f8] px-1 py-6">
          <SectionTitle title={copy.home.rankingSection} />
          <div className="mt-4 grid gap-3">
            {copy.leaderboard.concat([
              { rank: '4', name: 'Perplexity', category: copy.locale === 'en' ? 'Search engine' : '搜索引擎', score: '4.7' },
              { rank: '5', name: 'Claude 3', category: copy.locale === 'en' ? 'AI assistant' : 'AI 助手', score: '4.7' },
            ]).map((item) => (
              <div key={item.rank} className="grid grid-cols-[1.6rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3">
                <div className="text-xl font-black text-[#7f89a0]">{item.rank}</div>
                <ToolLogo name={item.name} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-[#11162b]">{item.name}</div>
                  <div className="truncate text-xs font-medium text-[#8a93a8]">{item.category}</div>
                </div>
                <Rating value={item.score} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="hidden space-y-4 lg:block">
        <section className="grid min-h-[16.5rem] overflow-hidden rounded-[1rem] bg-[#070b25] text-white shadow-[var(--navtoai-shadow-hero)] xl:grid-cols-[minmax(0,1fr)_33rem]">
          <div className="px-12 py-11">
            <h1 className="max-w-[35rem] text-[2.85rem] font-black leading-tight">{splitAiTitle(copy.home.title)}</h1>
            <p className="mt-3 text-base font-semibold text-[#b9c0d8]">{copy.home.subtitle}</p>

            <form onSubmit={submitSearch} className="mt-6 max-w-[30.5rem]">
              <div className="flex h-12 items-center rounded-[0.7rem] bg-white p-1.5">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.home.heroSearchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent px-4 text-sm font-medium text-[#11162b] outline-none placeholder:text-[#a8b0c2]"
                />
                <button type="submit" className="h-9 rounded-[0.55rem] bg-[#6257ff] px-6 text-sm font-bold text-white">
                  {copy.common.search}
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#b9c0d8]">{copy.home.hotSearches}:</span>
              {copy.quickSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => navigateTo(`/search?q=${encodeURIComponent(term)}`)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/88"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
          <HeroAiDevice />
        </section>

        <section className="grid gap-3 xl:grid-cols-6">
          {copy.categoryCards.map((category, index) => {
            const Icon = categoryIconMap[index] || categoryIconMap[5];
            return (
              <button
                key={category.title}
                type="button"
                onClick={() => navigateTo(category.href)}
                className="flex items-center gap-3 rounded-[0.8rem] border border-[#edf0f8] bg-white px-4 py-3 text-left shadow-[0_12px_28px_-24px_rgba(25,31,68,0.28)]"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.7rem] ${categoryAccentClass[category.accent]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#11162b]">{category.title}</span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-[#8790a4]">{category.description.split(/[,.。]/)[0]}</span>
                </span>
              </button>
            );
          })}
        </section>

        <section className="pt-3">
          <SectionTitle title={`🔥 ${copy.home.featuredSection}`} action={copy.common.browseAll} onAction={() => navigateTo('/products')} />
          <div className="mt-4 grid gap-4 xl:grid-cols-5">
            {copy.featuredProjects.map((project) => (
              <article key={project.name} className="rounded-[0.9rem] border border-[#edf0f8] bg-white p-5 shadow-[0_16px_34px_-28px_rgba(25,31,68,0.32)]">
                <div className="flex items-start gap-3">
                  <ToolLogo name={project.name} />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-[#11162b]">{project.name}</h3>
                    <p className="text-xs font-semibold text-[#8d95aa]">{project.vendor}</p>
                  </div>
                </div>
                <p className="mt-4 min-h-[4.5rem] text-sm leading-6 text-[#606b80]">{project.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {project.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full bg-[#f0f2ff] px-2.5 py-1 text-[0.68rem] font-bold text-[#6257ff]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <Rating value={project.rating} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr_0.9fr]">
          <article className="rounded-[0.9rem] border border-[#edf0f8] bg-white p-5 shadow-[0_16px_34px_-30px_rgba(25,31,68,0.28)]">
            <SectionTitle title={`📈 ${copy.home.rankingSection}`} />
            <div className="mt-4 grid gap-3">
              {copy.leaderboard.map((item) => (
                <div key={item.rank} className="grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3">
                  <div className="font-black text-[#ff9248]">{item.rank}</div>
                  <ToolLogo name={item.name} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-[#11162b]">{item.name}</div>
                    <div className="truncate text-xs font-medium text-[#8a93a8]">{item.category}</div>
                  </div>
                  <Rating value={item.score} compact />
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[0.9rem] border border-[#edf0f8] bg-white p-5 shadow-[0_16px_34px_-30px_rgba(25,31,68,0.28)]">
            <SectionTitle title={`📰 ${copy.home.latestNewsSection}`} />
            <div className="mt-4 grid gap-3">
              {copy.newsItems.map((item) => (
                <article key={item.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] gap-3">
                  <span className="h-10 w-10 rounded-[0.7rem] bg-[#07102e]" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-[#11162b]">{item.title}</h3>
                    <p className="mt-1 truncate text-xs font-medium text-[#7e879b]">{item.summary}</p>
                  </div>
                  <span className="text-right text-xs font-medium text-[#9aa3b5]">{item.time}</span>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[0.9rem] border border-[#edf0f8] bg-white p-5 shadow-[0_16px_34px_-30px_rgba(25,31,68,0.28)]">
            <SectionTitle title={`⭐ ${copy.home.hotTagsSection}`} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {copy.hotTags.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => navigateTo(`/search?q=${encodeURIComponent(tag.label)}`)}
                  className={`rounded-[0.7rem] px-3 py-2 text-left text-xs font-bold ${tagAccentClass[tag.accent]}`}
                >
                  # {tag.label}
                </button>
              ))}
            </div>
          </article>
        </section>
      </div>
    </MarketplaceFrame>
  );
});

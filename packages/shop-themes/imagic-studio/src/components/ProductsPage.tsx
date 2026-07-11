'use client';

import { ArrowRight, Heart, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ProductsPageProps } from 'shared/src/types/theme';

import { featuredCards, inspirationCategories, recentCreations, templateCards } from '../site';
import { StudioBadge, StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

const galleryCards = [...featuredCards, ...templateCards];

export function ProductsPage({ isLoading }: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return galleryCards.filter((card) => {
      const categoryMatch =
        activeCategory === 'all' ||
        card.id.includes(activeCategory) ||
        (activeCategory === 'poster' && /poster|banner/i.test(`${card.id} ${card.title}`)) ||
        (activeCategory === 'product' && /product|brand|mascot/i.test(`${card.id} ${card.title}`)) ||
        (activeCategory === 'ui' && /ui|weather/i.test(`${card.id} ${card.title}`));
      const searchMatch = !query || [card.title, card.subtitle, card.ratio].join(' ').toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, searchQuery]);

  if (isLoading) {
    return (
      <StudioPage activeNav="explore">
        <StudioMain className="space-y-6">
          <div className="h-44 animate-pulse rounded-[2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[360px] animate-pulse rounded-[1.8rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/70" />
            ))}
          </div>
        </StudioMain>
      </StudioPage>
    );
  }

  return (
    <StudioPage activeNav="explore">
      <StudioMain className="space-y-8">
        <StudioPanel className="overflow-hidden">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <StudioSectionIntro
              eyebrow="Explore"
              title="Explore polished visual systems for prompts, campaigns, and launch assets."
              body="This is the imagic inspiration wall: real generated looks, reusable prompt directions, and aspect-ratio templates—not the default Jiffoo product seed data."
            />
            <a href="/pricing" className="imagic-button-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              Get credits
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--imagic-muted)]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search templates, looks, ratios, or prompt directions..."
                className="h-12 w-full rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] pl-11 pr-4 text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-[color:var(--imagic-muted)]"
              />
            </label>
            <StudioBadge>{filteredCards.length} visible looks</StudioBadge>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {inspirationCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === category.id
                    ? 'border-[color:var(--imagic-primary)] bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]'
                    : 'border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] text-[color:var(--imagic-ink-soft)]'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </StudioPanel>

        {filteredCards.length === 0 ? (
          <StudioPanel className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--imagic-ink)]">No looks matched that search.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--imagic-ink-soft)]">
              Try a broader keyword or switch back to All to browse every imagic template.
            </p>
          </StudioPanel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => (
              <article key={card.id} className="group overflow-hidden rounded-[1.9rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/94 shadow-[var(--imagic-soft-shadow)] transition hover:-translate-y-1">
                <div className="relative aspect-[1.1/1] overflow-hidden border-b border-[color:var(--imagic-line)]">
                  <img src={card.image} alt={card.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <button type="button" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[color:var(--imagic-ink)] shadow-[var(--imagic-soft-shadow)] backdrop-blur">
                    <Heart className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <StudioBadge>{card.ratio}</StudioBadge>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">imagic.art</span>
                  </div>
                  <h2 className="mt-4 text-[1.7rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[color:var(--imagic-ink)]">{card.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">{card.subtitle}</p>
                  <a href="/#create" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--imagic-primary)]">
                    Use as prompt direction
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        <StudioPanel>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <StudioSectionIntro
              eyebrow="Recent creations"
              title="Generated looks already in the imagic visual library."
              body="These replace the old ecommerce seed products and keep the site centered on creation, not catalog filler."
            />
            <a href="/#create" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--imagic-primary)]">
              Start generating
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentCreations.slice(0, 4).map((item) => (
              <article key={item.id} className="overflow-hidden rounded-[1.4rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)]">
                <img src={item.image} alt={item.title} className="aspect-[1.1/1] w-full object-cover" />
                <p className="px-4 py-3 text-sm font-semibold text-[color:var(--imagic-ink)]">{item.title}</p>
              </article>
            ))}
          </div>
        </StudioPanel>
      </StudioMain>
    </StudioPage>
  );
}

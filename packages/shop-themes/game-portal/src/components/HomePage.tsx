import React, { useEffect, useState } from 'react';
import type { HomePageProps } from 'shared/src/types/theme';
import { recentGames, type GameEntry } from '../lib/catalog';
import { GameCard, GameGrid, SectionHead, useCatalog } from './pieces';

/** PLAYGROUND 游戏大厅首页：精选轮播 + 继续游玩 + 分类卡墙 */
export function HomePage({ onNavigate }: HomePageProps) {
  const { catalog, error } = useCatalog();
  const [tick, setTick] = useState(0);
  // 继续游玩依赖 localStorage，挂载后刷新一次
  useEffect(() => setTick(t => t + 1), []);

  if (error) return <div className="py-16 text-center text-[#9a9aad]">{error}</div>;
  if (!catalog) return <div className="py-16 text-center text-[#9a9aad]">正在装填游戏库…</div>;

  const { categories, games } = catalog;
  const featured = games.filter(g => g.featured);
  const slides = featured.length ? featured : games.slice(0, 3);
  const recent = recentGames(games, 8);

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-10">
      {/* Hero 轮播 */}
      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <HeroCarousel slides={slides} onNavigate={onNavigate} />
        <div
          className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/15 p-4 text-center text-[12.5px] text-[#9a9aad]"
          style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 12px, rgba(255,255,255,.04) 12px 24px)' }}
        >
          <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] tracking-[.2em] text-[#6b6b7e]">广告</span>
          <strong className="text-[15px] text-[#c9c9d9]">广告位</strong>
          这里预留游戏内精选推荐位
        </div>
      </div>

      {recent.length >= 2 ? (
        <section className="mb-6">
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="m-0 text-[19px] font-semibold text-white">继续游玩</h2>
          </div>
          <div className="grid auto-flow-col gap-3.5 overflow-x-auto pb-1.5" style={{ gridAutoColumns: '220px' }} key={tick}>
            {recent.map(game => (
              <GameCard key={game.id} game={game} onNavigate={onNavigate} withBar />
            ))}
          </div>
        </section>
      ) : null}

      {categories
        .map(cat => ({ cat, list: games.filter(g => g.category === cat.key) }))
        .filter(section => section.list.length)
        .map(section => (
          <section key={section.cat.key} className="mb-7">
            <SectionHead title={`${section.cat.label}游戏`} seeAllHref={`/games?category=${section.cat.key}`} onNavigate={onNavigate} />
            <GameGrid games={section.list.slice(0, 12)} onNavigate={onNavigate} />
          </section>
        ))}
    </div>
  );
}

function HeroCarousel({ slides, onNavigate }: { slides: GameEntry[]; onNavigate?: (path: string) => void }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length]);
  if (!slides.length) return null;
  const slide = slides[current];
  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-[18px] border border-white/10 bg-[#15151f]">
      <div
        className="absolute inset-0 scale-[1.02] bg-cover bg-center"
        style={{ backgroundImage: `url('${slide.thumb ?? ''}')`, opacity: 0.85 }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(8,8,14,.92) 0%, rgba(8,8,14,.55) 45%, rgba(8,8,14,.15) 100%)' }} />
      <div className="relative z-10 flex h-full flex-col justify-center gap-3 px-9 py-8" style={{ maxWidth: 560, minHeight: 320 }}>
        <span
          className="inline-flex self-start rounded-full border border-[rgba(124,92,255,.4)] px-3 py-1 text-[11px] font-bold tracking-[.14em] text-[#9d7bff]"
          style={{ background: 'rgba(124,92,255,.16)' }}
        >
          精选游戏
        </span>
        <h1 className="m-0 text-[34px] leading-[1.15] text-white">{slide.title}</h1>
        <p className="m-0 max-w-[430px] text-[#c9c9d9]">{slide.desc}</p>
        <div className="mt-2.5 flex gap-3">
          <a
            href={`/games/${slide.id}`}
            onClick={e => {
              e.preventDefault();
              onNavigate?.(`/games/${slide.id}`);
            }}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white no-underline transition-transform hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg,#7c5cff,#6a48f2)', boxShadow: '0 6px 20px rgba(124,92,255,.4)' }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            立即开玩
          </a>
          <a
            href={`/games/${slide.id}`}
            onClick={e => {
              e.preventDefault();
              onNavigate?.(`/games/${slide.id}`);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-[14px] font-semibold text-white no-underline hover:bg-white/10"
          >
            游戏详情
          </a>
        </div>
      </div>
      {slides.length > 1 ? (
        <div className="absolute bottom-5 left-9 z-10 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`切换到第 ${i + 1} 个精选`}
              onClick={() => setCurrent(i)}
              className="h-1 w-[18px] rounded border-0 p-0"
              style={{ background: i === current ? '#7c5cff' : 'rgba(255,255,255,.25)', cursor: 'pointer' }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;

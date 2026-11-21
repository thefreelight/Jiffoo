import React, { useEffect, useState } from 'react';
import {
  type GameCategory,
  type GameEntry,
  loadProgress,
} from '../lib/catalog';

export function useCatalog() {
  const [catalog, setCatalog] = useState<{ categories: GameCategory[]; games: GameEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const core = await fetch('/extensions/themes/shop/game-portal/data/games.json', { cache: 'no-store' }).then(r => r.json());
        let gmGames: GameEntry[] = [];
        try {
          const gm = await fetch('/extensions/themes/shop/game-portal/data/games-gm.json', { cache: 'no-store' }).then(r => r.json());
          gmGames = gm.games ?? [];
        } catch {
          gmGames = [];
        }
        if (alive) setCatalog({ categories: core.categories ?? [], games: [...(core.games ?? []), ...gmGames] });
      } catch {
        if (alive) setError('游戏目录加载失败，请刷新重试。');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return { catalog, error };
}

export function originBadge(game: GameEntry): string {
  return game.origin === 'own' ? '官方出品' : game.origin === 'oss' ? '开源游戏' : '在线游戏';
}

export function GameCard({
  game,
  onNavigate,
  withBar = false,
}: {
  game: GameEntry;
  onNavigate?: (path: string) => void;
  withBar?: boolean;
}) {
  const prog = withBar ? loadProgress()[game.id] : undefined;
  return (
    <a
      href={`/games/${game.id}`}
      onClick={event => {
        event.preventDefault();
        onNavigate?.(`/games/${game.id}`);
      }}
      className="group relative block overflow-hidden rounded-[14px] border border-white/10 bg-[#15151f] transition-all hover:-translate-y-0.5 hover:border-[rgba(124,92,255,.55)] hover:shadow-[0_10px_26px_rgba(0,0,0,.45)]"
    >
      <span className="block aspect-[16/10] w-full bg-[#1c1c2a]">
        {game.thumb ? (
          <img src={game.thumb} alt="" loading="lazy" className="h-full w-full object-cover" onError={event => { event.currentTarget.remove(); }} />
        ) : null}
      </span>
      <span
        className="absolute right-2.5 top-[calc(62.5%-34px)] grid h-[34px] w-[34px] place-items-center rounded-full text-white opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: 'linear-gradient(135deg,#7c5cff,#6a48f2)', boxShadow: '0 4px 14px rgba(124,92,255,.5)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
      <span className="block px-3 pb-3 pt-2.5">
        <span className="block truncate text-[13.5px] font-semibold text-white">{game.title}</span>
        <span className="mt-0.5 block text-[11.5px] text-[#9a9aad]">{originBadge(game)}</span>
        {prog ? (
          <span className="mt-2 block h-1 overflow-hidden rounded bg-white/10">
            <span className="block h-full rounded bg-gradient-to-r from-[#7c5cff] to-[#9d7bff]" style={{ width: `${prog.p}%` }} />
          </span>
        ) : null}
      </span>
    </a>
  );
}

export function SectionHead({
  title,
  count,
  onNavigate,
  seeAllHref,
}: {
  title: string;
  count?: number;
  onNavigate?: (path: string) => void;
  seeAllHref?: string;
}) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between">
      <h2 className="m-0 text-[19px] font-semibold text-white">{title}</h2>
      {seeAllHref ? (
        <a href={seeAllHref} onClick={e => { e.preventDefault(); onNavigate?.(seeAllHref); }} className="text-[13px] text-[#9d7bff] hover:underline">
          查看全部 ›
        </a>
      ) : count !== undefined ? (
        <span className="text-[13px] text-[#9a9aad]">{count} 款游戏</span>
      ) : null}
    </div>
  );
}

export function GameGrid({ games, onNavigate }: { games: GameEntry[]; onNavigate?: (path: string) => void }) {
  if (!games.length) return <div className="py-10 text-center text-[#9a9aad]">这个分类还没有游戏，敬请期待。</div>;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))' }}>
      {games.map(game => (
        <GameCard key={game.id} game={game} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export function categoryLabel(key: string, categories?: GameCategory[]): string {
  return categories?.find(c => c.key === key)?.label ?? key;
}

import React, { useEffect, useRef, useState } from 'react';
import type { GameDetailPageProps } from 'shared/src/types/theme';
import { touchProgress, type GameEntry } from '../lib/catalog';
import { GameCard, originBadge, useCatalog } from './pieces';

type NavProps = { onNavigate?: (path: string) => void };

/** 游戏详情/游玩页：iframe 舞台 + 介绍 + 相关推荐 */
export function GameDetailPage(props: GameDetailPageProps & NavProps) {
  const { catalog, error } = useCatalog();
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // 计入游玩时长
  useEffect(() => {
    const timer = setInterval(() => touchProgress(props.gameId ?? '', 30), 30000);
    return () => clearInterval(timer);
  }, [props.gameId]);

  if (error) return <div className="py-16 text-center text-[#9a9aad]">{error}</div>;
  if (!catalog) return <div className="py-16 text-center text-[#9a9aad]">正在装填游戏库…</div>;

  const game: GameEntry | undefined = catalog.games.find(g => g.id === props.gameId);
  if (!game) {
    return (
      <div className="py-16 text-center text-[#9a9aad]">
        没有找到这个游戏。
        <a href="/" onClick={e => { e.preventDefault(); props.onNavigate?.('/'); }} className="text-[#9d7bff]">返回首页</a>
      </div>
    );
  }

  touchProgress(game.id);
  const related = catalog.games.filter(x => x.category === game.category && x.id !== game.id).slice(0, 6);
  const sourceLine =
    game.origin === 'gm'
      ? '本游戏经 GameMonetize 平台授权分发，版权归原开发者所有。'
      : game.origin === 'oss'
        ? `开源游戏 · 许可证：${game.license ?? ''}${game.sourceUrl ? ` · 来源仓库见致谢页` : ''} · 感谢原作者。`
        : 'PLAYGROUND 官方出品';

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (stageRef.current?.requestFullscreen) {
      stageRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-10">
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            props.onNavigate?.('/');
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[14px] font-semibold text-white no-underline hover:bg-white/10"
        >
          ‹ 返回
        </a>
        <h1 className="m-0 text-[22px] text-white">{game.title}</h1>
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[12px] text-[#9a9aad]">{originBadge(game)}</span>
        {(game.tags ?? []).map(tag => (
          <span key={tag} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[12px] text-[#9a9aad]">#{tag}</span>
        ))}
        <span className="flex-1" />
        <button
          onClick={toggleFullscreen}
          className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[14px] font-semibold text-white hover:bg-white/10"
        >
          全屏
        </button>
      </div>

      <div ref={stageRef} className="overflow-hidden rounded-[18px] border border-white/10 bg-black" style={{ height: 'min(72vh, 760px)' }}>
        <iframe
          src={game.path}
          title={game.title}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen; accelerometer; gyroscope"
          allowFullScreen
          loading="lazy"
        />
      </div>

      <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div className="rounded-2xl border border-white/10 bg-[#15151f] px-5 py-4">
          <h3 className="m-0 mb-2 text-[15px] text-white">游戏介绍</h3>
          <p className="m-1.5 text-[13.5px] text-[#c5c5d5]">{game.desc}</p>
          <h3 className="mb-2 mt-4 text-[15px] text-white">玩法说明</h3>
          <p className="m-1.5 text-[13.5px] text-[#c5c5d5]">{game.how}</p>
          <p className="mt-3 border-t border-white/10 pt-2.5 text-[12px] text-[#9a9aad]">{sourceLine}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#15151f] px-4 py-4">
          <h3 className="m-0 mb-3 text-[15px] text-white">相关游戏</h3>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {related.map(x => (
              <GameCard key={x.id} game={x} onNavigate={props.onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameDetailPage;

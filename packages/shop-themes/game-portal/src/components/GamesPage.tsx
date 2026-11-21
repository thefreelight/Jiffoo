import React, { useEffect, useState } from 'react';
import type { GamesPageProps } from 'shared/src/types/theme';
import { GameGrid, SectionHead, useCatalog } from './pieces';

type NavProps = { onNavigate?: (path: string) => void };

function readFilters(): { category: string; query: string } {
  if (typeof window === 'undefined') return { category: '', query: '' };
  const params = new URLSearchParams(window.location.search);
  return { category: params.get('category') ?? '', query: params.get('q') ?? '' };
}

/** 全部游戏 + 分类过滤（?category=<key>）+ 搜索（?q=<关键词>） */
export function GamesPage(props: GamesPageProps & NavProps) {
  const { catalog, error } = useCatalog();
  const [filters, setFilters] = useState(readFilters);
  useEffect(() => {
    const onChange = () => setFilters(readFilters());
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  if (error) return <div className="py-16 text-center text-[#9a9aad]">{error}</div>;
  if (!catalog) return <div className="py-16 text-center text-[#9a9aad]">正在装填游戏库…</div>;

  const { categories, games } = catalog;
  let list = games;
  let title = '全部游戏';
  if (filters.category) {
    const cat = categories.find(c => c.key === filters.category);
    list = games.filter(g => g.category === filters.category);
    title = `${cat ? cat.label : filters.category}游戏`;
  } else if (filters.query) {
    const ql = filters.query.toLowerCase();
    list = games.filter(g => g.title.toLowerCase().includes(ql) || (g.tags ?? []).some(t => t.toLowerCase().includes(ql))).slice(0, 60);
    title = `「${filters.query}」的搜索结果`;
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-10">
      <section className="my-4">
        <SectionHead title={title} count={list.length} />
        <GameGrid games={list} onNavigate={props.onNavigate} />
      </section>
    </div>
  );
}

export default GamesPage;

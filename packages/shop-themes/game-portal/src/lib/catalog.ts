// PLAYGROUND 游戏目录数据层：主题资产同源路径加载（非版本化 canonical 路径，
// 目录更新 max-age=300 生效，无需 bump 主题版本）。
export interface GameEntry {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  desc: string;
  how?: string;
  /** 游玩地址：同源静态包路径或 GM 官方 embed 绝对 URL */
  path: string;
  thumb?: string;
  origin?: 'own' | 'oss' | 'gm';
  license?: string;
  sourceName?: string;
  sourceUrl?: string;
  featured?: boolean;
}

export interface GameCategory {
  key: string;
  label: string;
}

export interface GameCatalog {
  categories: GameCategory[];
  games: GameEntry[];
}

/** 主题资产同源 canonical 路径（R2: extensions/themes/shop/game-portal/…） */
export const CATALOG_BASE = '/extensions/themes/shop/game-portal';

export const GAME_CATEGORIES: GameCategory[] = [
  { key: 'puzzle', label: '益智' },
  { key: 'arcade', label: '街机' },
  { key: 'action', label: '动作' },
  { key: 'casual', label: '休闲' },
  { key: 'board', label: '桌面' },
  { key: 'racing', label: '竞速' },
];

const PROGRESS_KEY = 'playground.progress.v1';

export async function fetchCatalog(): Promise<GameCatalog> {
  const core = await fetch(`${CATALOG_BASE}/data/games.json`, { cache: 'no-store' }).then(r => r.json());
  let gmGames: GameEntry[] = [];
  try {
    const gm = await fetch(`${CATALOG_BASE}/data/games-gm.json`, { cache: 'no-store' }).then(r => r.json());
    gmGames = (gm.games ?? []) as GameEntry[];
  } catch {
    gmGames = [];
  }
  const categories: GameCategory[] = core.categories ?? GAME_CATEGORIES;
  const games: GameEntry[] = [...(core.games ?? []), ...gmGames];
  return { categories, games };
}

export const catLabel = (key: string, categories?: GameCategory[]) =>
  categories?.find(c => c.key === key)?.label ?? key;

export const originBadge = (g: GameEntry) =>
  g.origin === 'own' ? '官方出品' : g.origin === 'oss' ? '开源游戏' : '在线游戏';

export function loadProgress(): Record<string, { t: number; s: number; p: number }> {
  try {
    return JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem(PROGRESS_KEY) ?? '{}' : '{}') ?? {};
  } catch {
    return {};
  }
}

export function touchProgress(id: string, deltaSec = 0) {
  if (typeof localStorage === 'undefined') return;
  try {
    const all = loadProgress();
    const cur = all[id] ?? { t: 0, s: 0, p: 0 };
    cur.t = Date.now();
    cur.s = Math.min(3600, cur.s + deltaSec);
    cur.p = Math.min(90, Math.round(cur.s / 12));
    all[id] = cur;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    /* 隐私模式忽略 */
  }
}

export function recentGames(catalog: GameEntry[], limit = 8): GameEntry[] {
  const prog = loadProgress();
  return Object.entries(prog)
    .sort((a, b) => (b[1].t ?? 0) - (a[1].t ?? 0))
    .map(([id]) => catalog.find(g => g.id === id))
    .filter((g): g is GameEntry => Boolean(g))
    .slice(0, limit);
}

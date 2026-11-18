/**
 * Route draft model + deterministic usage estimation.
 *
 * PRD §10 路线草稿 minimum fields: 路线版本、有序站点、日期/天数、用途、
 * 热点要求. The draft is versioned: every mutation bumps `version`, and
 * recommendation results carry the route version they were computed for so
 * stale results can never render over a newer edit (PRD §5.3/§12).
 */

export const USAGE_PROFILES_VERSION = 'usage-profiles-v1';

export type UsageMode = 'mapChat' | 'meetings';

export interface RouteStop {
  /** Stable per-stop id (route position changes are reorderings, not edits). */
  id: string;
  /** ISO 3166-1 alpha-2 destination code. */
  code: string;
  /** Complete continuous usage days, minimum 1 (PRD §5.3). */
  days: number;
}

export interface RouteDraft {
  /** Bumped on every mutation; recommendation results pin this version. */
  version: number;
  stops: RouteStop[];
  usageMode: UsageMode;
  hotspot: boolean;
  /** ISO date (yyyy-mm-dd) optional trip start; days-only when absent. */
  startDate?: string;
}

export function createEmptyDraft(): RouteDraft {
  return { version: 0, stops: [], usageMode: 'mapChat', hotspot: false };
}

let stopIdCounter = 0;
export function nextStopId(): string {
  stopIdCounter += 1;
  return `stop-${Date.now().toString(36)}-${stopIdCounter}`;
}

export function cloneDraft(draft: RouteDraft): RouteDraft {
  return {
    ...draft,
    stops: draft.stops.map((stop) => ({ ...stop })),
  };
}

/** Total continuous days (continuous-mode v0.0.1: days simply add up). */
export function tripSpanDays(draft: RouteDraft): number {
  return draft.stops.reduce((sum, stop) => sum + Math.max(1, Math.floor(stop.days || 1)), 0);
}

/** Unique destination codes covered by the route (PRD §12: coverage per unique region). */
export function tripDestinations(draft: RouteDraft): string[] {
  const codes = new Set<string>();
  for (const stop of draft.stops) codes.add(stop.code);
  return [...codes];
}

/**
 * Deterministic usage estimate (GB). Map+chat is the default profile;
 * video meetings raise the daily budget substantially; personal hotspot
 * applies a multiplier. Numbers are deliberately conservative — the UI
 * always shows them as “预计需要约 X GB” with a tuning affordance.
 */
const PER_DAY_GB: Record<UsageMode, number> = {
  mapChat: 0.15,
  meetings: 1.5,
};
export const HOTSPOT_MULTIPLIER = 1.5;

export function estimateUsageGb(draft: RouteDraft): number {
  const span = tripSpanDays(draft);
  const perDay = PER_DAY_GB[draft.usageMode] ?? PER_DAY_GB.mapChat;
  const raw = span * perDay * (draft.hotspot ? HOTSPOT_MULTIPLIER : 1);
  // Round up to one decimal — never show fractional nonsense.
  return Math.ceil(raw * 10) / 10;
}

/** Draft persistence (PRD: 返回页面恢复最近路线). Best-effort localStorage. */
const DRAFT_STORAGE_KEY = 'esim.route.draft.v1';

export function saveDraft(draft: RouteDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (private mode, quota) — draft stays in memory.
  }
}

export function loadDraft(): RouteDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RouteDraft;
    if (!parsed || !Array.isArray(parsed.stops)) return null;
    return {
      version: Number(parsed.version) || 0,
      stops: parsed.stops
        .filter((stop) => stop && typeof stop.code === 'string' && stop.code.length === 2)
        .map((stop) => ({
          id: typeof stop.id === 'string' && stop.id ? stop.id : nextStopId(),
          code: stop.code.toUpperCase(),
          days: Math.max(1, Math.floor(Number(stop.days) || 1)),
        })),
      usageMode: parsed.usageMode === 'meetings' ? 'meetings' : 'mapChat',
      hotspot: Boolean(parsed.hotspot),
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : undefined,
    };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Best effort.
  }
}

import React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Plus, Search, Trash2, X } from 'lucide-react';
import type { ThemeConfig } from 'shared/src/types/theme';
import { getEsimProducts, type EsimApiProduct } from '../../lib/api';
import { resolveEsimSiteConfig } from '../../site';
import {
  buildDestinationCatalog,
  destinationLabel,
  lookupDestination,
  planPrice,
  readPlanAttributes,
  searchDestinations,
  type DestinationCatalogEntry,
} from '../../lib/esim/catalog';
import {
  cloneDraft,
  createEmptyDraft,
  estimateUsageGb,
  loadDraft,
  nextStopId,
  saveDraft,
  tripSpanDays,
  type RouteDraft,
  type UsageMode,
} from '../../lib/esim/itinerary';
import { matchRoute, type MatchOutcome, type PlanRecommendation } from '../../lib/esim/matcher';

/**
 * 路线通 (Route Planner) — the esim theme homepage experience.
 *
 * PRD §5: hero route map, left route editor, right recommendation.
 * Deterministic client-side matching over the type=esim catalog snapshot;
 * zero model calls; route-draft versioning guards against stale results.
 */

const HAIRLINE = 'border-[color:rgba(255,255,255,0.08)]';

/* Owner-specified placeholder identifiers — never ship real ones. */
export const EXAMPLE_TRIP_STOPS = [
  { code: 'JP', days: 5 },
  { code: 'KR', days: 4 },
  { code: 'SG', days: 8 },
];

type CatalogState = 'loading' | 'ready' | 'error';

function useCopy(locale?: string) {
  const t = React.useCallback(
    (copy: { en: string; hans: string; hant: string }) => {
      if (locale === 'zh-Hant') return copy.hant;
      if (locale && locale.startsWith('zh')) return copy.hans;
      return copy.en;
    },
    [locale]
  );
  return t;
}

function PriceTag({ price, currency }: { price: number; currency: string }) {
  const symbol = currency === 'USD' ? '$' : currency === 'CNY' ? '¥' : `${currency} `;
  return (
    <span className="text-3xl font-semibold tracking-tight text-[var(--esim-gold)]">
      {symbol}
      {price}
    </span>
  );
}

function SampleBadge({ product }: { product: EsimApiProduct }) {
  const attrs = readPlanAttributes(product);
  if ((attrs as { sample?: boolean }).sample !== true) return null;
  return (
    <span className="rounded border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.12)] px-2 py-0.5 text-[11px] font-medium tracking-[0.14em] text-[var(--esim-gold-strong)]">
      SAMPLE
    </span>
  );
}

function VerifiedChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
        ok
          ? 'bg-[rgba(212,175,55,0.12)] text-[var(--esim-gold-strong)]'
          : 'bg-[rgba(255,255,255,0.06)] text-[var(--esim-copy-soft)]'
      }`}
    >
      <Check aria-hidden="true" className="h-3 w-3" />
      {label}
    </span>
  );
}

/* ---------------- Destination picker (PRD §5.2) ---------------- */

function DestinationPicker({
  open,
  locale,
  catalog,
  staged,
  onToggle,
  onConfirm,
  onCancel,
  singleMode,
}: {
  open: boolean;
  locale?: string;
  catalog: DestinationCatalogEntry[];
  staged: string[];
  onToggle: (code: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  singleMode: boolean;
}) {
  const t = useCopy(locale);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  if (!open) return null;

  const sellableCodes = new Set(catalog.map((entry) => entry.info.code));
  const matchedInfos = query.trim() ? searchDestinations(query, 12) : null;
  const results: DestinationCatalogEntry[] = matchedInfos
    ? matchedInfos.map((info) => catalog.find((entry) => entry.info.code === info.code) || { info, planCount: 0, cheapestPrice: null, currency: null })
    : catalog.slice(0, 8);
  const visible = results.filter((entry) => !singleMode || !staged.includes(entry.info.code));
  const sellableResults = visible.filter((entry) => sellableCodes.has(entry.info.code));
  const unsellableResults = visible.filter((entry) => !sellableCodes.has(entry.info.code));

  const confirm = () => {
    if (staged.length > 0) onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={t({ en: 'Choose destinations', hans: '选择目的地', hant: '選擇目的地' })}>
      <div className="w-full max-w-lg rounded-t-2xl border border-[rgba(212,175,55,0.25)] bg-[#141414] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-[var(--esim-ink)]">
            {singleMode
              ? t({ en: 'Replace this stop', hans: '替换单站', hant: '替換單站' })
              : t({ en: 'Choose destinations', hans: '选择目的地', hant: '選擇目的地' })}
          </h3>
          <button type="button" onClick={onCancel} aria-label={t({ en: 'Close', hans: '关闭', hant: '關閉' })} className="rounded-full p-2 text-[var(--esim-copy)] hover:text-[var(--esim-ink)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--esim-copy-soft)]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t({ en: 'Search country, region or city (e.g. Tokyo)', hans: '搜索国家、地区或城市（如：东京）', hant: '搜尋國家、地區或城市（如：東京）' })}
            aria-label={t({ en: 'Destination search', hans: '目的地搜索', hant: '目的地搜尋' })}
            className="w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#1c1c1e] py-3 pl-10 pr-3 text-sm text-[var(--esim-ink)] placeholder:text-[var(--esim-copy-soft)] focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
          />
        </div>

        {!matchedInfos && !singleMode && (
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
            {t({ en: 'Popular destinations', hans: '热门目的地', hant: '熱門目的地' })}
          </p>
        )}

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {sellableResults.map((entry) => {
            const selected = staged.includes(entry.info.code);
            return (
              <button
                key={entry.info.code}
                type="button"
                onClick={() => onToggle(entry.info.code)}
                aria-pressed={selected}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                  selected
                    ? 'border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.12)] text-[var(--esim-ink)]'
                    : 'border-[rgba(255,255,255,0.1)] bg-[#1c1c1e] text-[var(--esim-copy)] hover:border-[rgba(212,175,55,0.3)]'
                }`}
              >
                <span>
                  {locale === 'zh-Hant' ? entry.info.hant : locale && locale.startsWith('zh') ? entry.info.hans : entry.info.en}
                  <span className="ml-2 text-xs text-[var(--esim-copy-soft)]">
                    {entry.planCount} {t({ en: 'plans', hans: '个套餐', hant: '個套餐' })}
                  </span>
                </span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-[var(--esim-gold)] bg-[var(--esim-gold)] text-black' : 'border-[rgba(255,255,255,0.2)]'}`}>
                  {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                </span>
              </button>
            );
          })}
          {unsellableResults.map((entry) => (
            <div key={entry.info.code} className="flex min-h-[44px] items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] px-4 py-2.5 text-sm text-[var(--esim-copy-soft)]">
              <span>{locale === 'zh-Hant' ? entry.info.hant : locale && locale.startsWith('zh') ? entry.info.hans : entry.info.en}</span>
              <span className="text-xs">{t({ en: 'No plans yet', hans: '暂无可售套餐', hant: '暫無可售套餐' })}</span>
            </div>
          ))}
          {matchedInfos && sellableResults.length === 0 && unsellableResults.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--esim-copy-soft)]">
              {t({ en: 'No destination found. Clear the search to browse all.', hans: '没有找到这个目的地，清空搜索查看全部。', hant: '沒有找到這個目的地，清空搜尋查看全部。' })}
            </p>
          )}
        </div>

        {!singleMode && (
          <>
            {staged.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {staged.map((code) => (
                  <button key={code} type="button" onClick={() => onToggle(code)} className="inline-flex items-center gap-1 rounded-full border border-[rgba(212,175,55,0.45)] bg-[rgba(212,175,55,0.1)] px-3 py-1 text-xs text-[var(--esim-gold-strong)]">
                    {destinationLabel(code, locale)}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={confirm}
              disabled={staged.length === 0}
              className="mt-4 min-h-[44px] w-full rounded-xl bg-[var(--esim-gold)] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[var(--esim-gold-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t({ en: `Confirm ${staged.length} destination${staged.length === 1 ? '' : 's'}`, hans: `确认 ${staged.length} 个目的地`, hant: `確認 ${staged.length} 個目的地` })}
            </button>
            <p className="mt-2 text-center text-xs text-[var(--esim-copy-soft)]">
              {t({ en: 'Closing without confirming keeps your current route.', hans: '不确认直接关闭将保留原路线。', hant: '不確認直接關閉將保留原路線。' })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Route progress (hero nodes) ---------------- */

function RouteProgress({ draft, locale, onEditClick }: { draft: RouteDraft; locale?: string; onEditClick: () => void }) {
  const t = useCopy(locale);
  const span = tripSpanDays(draft);
  return (
    <div className="w-full">
      {draft.stops.length === 0 ? (
        <div className="flex items-center gap-3 py-6" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="h-px flex-1 border-t border-dashed border-[rgba(255,255,255,0.18)]" />}
              <span className="h-3.5 w-3.5 rounded-full border border-[rgba(255,255,255,0.25)]" />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <ol className="flex items-start py-6">
          {draft.stops.map((stop, index) => (
            <React.Fragment key={stop.id}>
              {index > 0 && <span className="mt-[7px] h-px flex-1 bg-[rgba(212,175,55,0.45)]" aria-hidden="true" />}
              <li className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={onEditClick}
                  aria-label={`${destinationLabel(stop.code, locale)} ${stop.days} ${t({ en: 'days', hans: '天', hant: '天' })}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--esim-gold)] bg-transparent"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--esim-gold)]" />
                </button>
                <span className="text-sm text-[var(--esim-ink)]">{destinationLabel(stop.code, locale)}</span>
                <span className="text-xs text-[var(--esim-gold)]">
                  {stop.days} {t({ en: 'day(s)', hans: '天', hant: '天' })}
                </span>
              </li>
            </React.Fragment>
          ))}
        </ol>
      )}
      {draft.stops.length > 0 && (
        <p className="text-xs text-[var(--esim-copy-soft)]">
          {t({ en: `Total ${span} days`, hans: `全程 ${span} 天`, hant: `全程 ${span} 天` })}
        </p>
      )}
    </div>
  );
}

/* ---------------- Route editor (PRD §5.3) ---------------- */

function RouteEditor({
  draft,
  locale,
  onDaysChange,
  onMove,
  onRemove,
  onAddStop,
  onReplaceStop,
  onUsageMode,
  onHotspotToggle,
}: {
  draft: RouteDraft;
  locale?: string;
  onDaysChange: (stopId: string, days: number) => void;
  onMove: (stopId: string, direction: -1 | 1) => void;
  onRemove: (stopId: string) => void;
  onAddStop: () => void;
  onReplaceStop: (stopId: string) => void;
  onUsageMode: (mode: UsageMode) => void;
  onHotspotToggle: (enabled: boolean) => void;
}) {
  const t = useCopy(locale);
  const estimatedGb = estimateUsageGb(draft);
  return (
    <div className={`rounded-2xl border ${HAIRLINE} bg-[#141414] p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium text-[var(--esim-ink)]">
          {t({ en: 'Itinerary', hans: '行程路线', hant: '行程路線' })}
          <span className="ml-2 text-xs text-[var(--esim-copy-soft)]">
            {t({ en: 'Editable', hans: '可编辑', hant: '可編輯' })}
          </span>
        </h3>
        <button
          type="button"
          onClick={onAddStop}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--esim-gold-strong)] hover:bg-[rgba(212,175,55,0.08)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t({ en: 'Add a stop', hans: '添加一站', hant: '添加一站' })}
        </button>
      </div>

      {draft.stops.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[rgba(255,255,255,0.15)] px-4 py-8 text-center text-sm text-[var(--esim-copy-soft)]">
          {t({ en: 'No stops yet — add your first destination.', hans: '还没有站点——添加第一个目的地。', hant: '還沒有站點——添加第一個目的地。' })}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {draft.stops.map((stop, index) => (
            <li key={stop.id} className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1c1c1e] px-3 py-2">
              <div className="flex flex-col" role="group" aria-label={t({ en: 'Reorder stop', hans: '调整顺序', hant: '調整順序' })}>
                <button
                  type="button"
                  onClick={() => onMove(stop.id, -1)}
                  disabled={index === 0}
                  aria-label={t({ en: 'Move up', hans: '上移', hant: '上移' })}
                  className="rounded p-0.5 text-[var(--esim-copy-soft)] hover:text-[var(--esim-gold)] disabled:opacity-25"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(stop.id, 1)}
                  disabled={index === draft.stops.length - 1}
                  aria-label={t({ en: 'Move down', hans: '下移', hant: '下移' })}
                  className="rounded p-0.5 text-[var(--esim-copy-soft)] hover:text-[var(--esim-gold)] disabled:opacity-25"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onReplaceStop(stop.id)}
                title={t({ en: 'Replace destination', hans: '替换目的地', hant: '替換目的地' })}
                className="min-h-[44px] flex-1 px-1 text-left text-sm font-medium text-[var(--esim-ink)] hover:text-[var(--esim-gold-strong)]"
              >
                {destinationLabel(stop.code, locale)}
              </button>
              <div className="flex items-center gap-1" role="group" aria-label={t({ en: 'Days', hans: '天数', hant: '天數' })}>
                <button
                  type="button"
                  onClick={() => onDaysChange(stop.id, Math.max(1, stop.days - 1))}
                  disabled={stop.days <= 1}
                  aria-label={t({ en: 'Fewer days', hans: '减少天数', hant: '減少天數' })}
                  className="min-h-[36px] w-8 rounded-lg border border-[rgba(255,255,255,0.12)] text-[var(--esim-copy)] hover:border-[rgba(212,175,55,0.4)] disabled:opacity-30"
                >
                  −
                </button>
                <label className="sr-only" htmlFor={`days-${stop.id}`}>
                  {t({ en: 'Days', hans: '天数', hant: '天數' })}
                </label>
                <input
                  id={`days-${stop.id}`}
                  type="number"
                  min={1}
                  value={stop.days}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (Number.isFinite(parsed) && parsed >= 1) onDaysChange(stop.id, parsed);
                  }}
                  className="w-12 rounded-lg border border-[rgba(255,255,255,0.12)] bg-transparent py-1.5 text-center text-sm text-[var(--esim-ink)] focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onDaysChange(stop.id, stop.days + 1)}
                  aria-label={t({ en: 'More days', hans: '增加天数', hant: '增加天數' })}
                  className="min-h-[36px] w-8 rounded-lg border border-[rgba(255,255,255,0.12)] text-[var(--esim-copy)] hover:border-[rgba(212,175,55,0.4)]"
                >
                  +
                </button>
                <span className="ml-1 text-xs text-[var(--esim-copy-soft)]">{t({ en: 'd', hans: '天', hant: '天' })}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(stop.id)}
                aria-label={t({ en: 'Remove stop', hans: '删除此站', hant: '刪除此站' })}
                className="min-h-[44px] rounded-lg p-2 text-[var(--esim-copy-soft)] hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1c1c1e] p-3">
        <p className="mb-2.5 text-xs uppercase tracking-[0.16em] text-[var(--esim-copy-soft)]">
          {t({ en: 'Usage', hans: '用法', hant: '用法' })}
        </p>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t({ en: 'Usage mode', hans: '用法模式', hant: '用法模式' })}>
          {([
            ['mapChat', t({ en: 'Maps & chat', hans: '地图聊天', hant: '地圖聊天' })],
            ['meetings', t({ en: 'Video meetings', hans: '工作会议', hant: '工作會議' })],
          ] as Array<[UsageMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={draft.usageMode === mode}
              onClick={() => onUsageMode(mode)}
              className={`min-h-[36px] rounded-full border px-3.5 py-1.5 text-xs ${
                draft.usageMode === mode
                  ? 'border-[var(--esim-gold)] bg-[rgba(212,175,55,0.14)] text-[var(--esim-gold-strong)]'
                  : 'border-[rgba(255,255,255,0.14)] text-[var(--esim-copy)]'
              }`}
            >
              {label}
            </button>
          ))}
          <label className="ml-auto inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-xs text-[var(--esim-copy)]">
            <input
              type="checkbox"
              checked={draft.hotspot}
              onChange={(event) => onHotspotToggle(event.target.checked)}
              className="h-4 w-4 accent-[var(--esim-gold)]"
            />
            {t({ en: 'Hotspot sharing', hans: '热点共享', hant: '熱點共享' })}
          </label>
        </div>
        {draft.stops.length > 0 && (
          <p className="mt-2.5 text-xs text-[var(--esim-copy-soft)]">
            {t({ en: `Estimated data need: ~${estimatedGb} GB`, hans: `预计需要约 ${estimatedGb} GB`, hant: `預計需要約 ${estimatedGb} GB` })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Recommendation card (PRD §5.4) ---------------- */

function RecommendationCard({
  outcome,
  locale,
  catalogState,
  onRetryCatalog,
  onViewPlan,
  exampleAvailable,
  onExample,
  onChooseDestinations,
}: {
  outcome: MatchOutcome;
  locale?: string;
  catalogState: CatalogState;
  onRetryCatalog: () => void;
  onViewPlan: (product: EsimApiProduct) => void;
  exampleAvailable: boolean;
  onExample: () => void;
  onChooseDestinations: () => void;
}) {
  const t = useCopy(locale);
  const [showAlternatives, setShowAlternatives] = React.useState(false);

  if (catalogState === 'loading') {
    return (
      <div className={`rounded-2xl border ${HAIRLINE} bg-[#141414] p-5`} aria-busy="true" aria-live="polite">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
        <div className="mb-3 h-8 w-40 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
        <div className="mb-6 h-4 w-56 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
        <div className="h-11 animate-pulse rounded-xl bg-[rgba(255,255,255,0.05)]" />
      </div>
    );
  }

  if (catalogState === 'error') {
    return (
      <div className={`rounded-2xl border ${HAIRLINE} bg-[#141414] p-5`} aria-live="polite">
        <p className="text-sm text-[var(--esim-copy)]">
          {t({ en: 'Plans are temporarily unavailable for quoting.', hans: '暂时无法报价，套餐目录暂不可用。', hant: '暫時無法報價，套餐目錄暫不可用。' })}
        </p>
        <button type="button" onClick={onRetryCatalog} className="mt-4 min-h-[44px] rounded-xl border border-[rgba(212,175,55,0.45)] px-4 py-2.5 text-sm text-[var(--esim-gold-strong)] hover:bg-[rgba(212,175,55,0.08)]">
          {t({ en: 'Retry', hans: '重试', hant: '重試' })}
        </button>
      </div>
    );
  }

  if (outcome.status === 'empty-route') {
    return (
      <div className={`rounded-2xl border ${HAIRLINE} bg-[#141414] p-5`}>
        <span className="mb-3 inline-block rounded border border-[rgba(212,175,55,0.35)] px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-[var(--esim-gold-strong)]">
          {t({ en: 'Route Planner', hans: '路线通', hant: '路線通' })}
        </span>
        <p className="text-sm leading-relaxed text-[var(--esim-copy)]">
          {t({
            en: 'Pick where you are going and for how long — we check which single eSIM covers the whole trip.',
            hans: '选择去哪、待多久——我们核对哪张 eSIM 能覆盖全程。',
            hant: '選擇去哪、待多久——我們核對哪張 eSIM 能覆蓋全程。',
          })}
        </p>
        <button
          type="button"
          onClick={onChooseDestinations}
          className="mt-5 min-h-[44px] w-full rounded-xl bg-[var(--esim-gold)] px-4 py-3 text-sm font-semibold text-black hover:bg-[var(--esim-gold-strong)]"
        >
          {t({ en: 'Choose destinations', hans: '选择目的地', hant: '選擇目的地' })}
        </button>
        {exampleAvailable && (
          <button type="button" onClick={onExample} className="mt-3 min-h-[44px] w-full rounded-xl border border-[rgba(255,255,255,0.14)] px-4 py-2.5 text-sm text-[var(--esim-copy)] hover:border-[rgba(212,175,55,0.35)]">
            {t({ en: 'Try the example trip', hans: '试试示例行程', hant: '試試示例行程' })}
          </button>
        )}
      </div>
    );
  }

  if (outcome.status === 'full-plan' && outcome.recommendation) {
    const rec = outcome.recommendation;
    const attrs = rec.attributes;
    return (
      <div aria-live="polite">
        <div className="rounded-2xl border border-[rgba(212,175,55,0.4)] bg-[#141414] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded border border-[rgba(212,175,55,0.35)] px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-[var(--esim-gold-strong)]">
              {t({ en: 'Best single eSIM', hans: '首选套餐', hant: '首選套餐' })}
            </span>
            <SampleBadge product={rec.product} />
          </div>
          <h3 className="text-xl font-medium text-[var(--esim-ink)]">{rec.product.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <VerifiedChip ok={rec.verified.allDestinationsCovered} label={t({ en: `${rec.coverageCodes.length} destinations covered`, hans: `${rec.coverageCodes.length} 个目的地已覆盖`, hant: `${rec.coverageCodes.length} 個目的地已覆蓋` })} />
            <VerifiedChip ok={rec.verified.validityCoversSpan} label={rec.verified.validityCoversSpan ? t({ en: 'Validity covers the whole trip', hans: '全程覆盖已核验', hant: '全程覆蓋已核驗' }) : t({ en: 'Validity to be confirmed', hans: '覆盖已确认，有效期待核验', hant: '覆蓋已確認，有效期待核驗' })} />
            {outcome.recommendation && outcome.recommendation.verified.hotspotConfirmed && (
              <VerifiedChip ok label={t({ en: 'Hotspot supported', hans: '支持热点共享', hant: '支持熱點共享' })} />
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1c1c1e] p-3 text-sm">
            <div>
              <p className="text-xs text-[var(--esim-copy-soft)]">{t({ en: 'Data', hans: '流量', hant: '流量' })}</p>
              <p className="text-[var(--esim-ink)]">{rec.gb !== null ? `${rec.gb} GB` : t({ en: 'See plan', hans: '见套餐', hant: '見套餐' })}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--esim-copy-soft)]">{t({ en: 'Validity', hans: '有效期', hant: '有效期' })}</p>
              <p className="text-[var(--esim-ink)]">{rec.validityDays !== null ? `${rec.validityDays} ${t({ en: 'days', hans: '天', hant: '天' })}` : t({ en: 'TBC', hans: '待核验', hant: '待核驗' })}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--esim-copy-soft)]">{t({ en: 'Network', hans: '网络', hant: '網絡' })}</p>
              <p className="text-[var(--esim-ink)]">{attrs.networks?.technology?.join(' / ') || '4G / LTE'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--esim-copy-soft)]">{t({ en: 'Activation', hans: '激活', hant: '激活' })}</p>
              <p className="text-[var(--esim-ink)]">{attrs.activation === 'first-use' ? t({ en: 'On first connection', hans: '首次联网起算', hant: '首次聯網起算' }) : attrs.activation || t({ en: 'Per plan terms', hans: '按套餐条款', hant: '按套餐條款' })}</p>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <PriceTag price={rec.price} currency={rec.currency} />
            <span className="text-xs text-[var(--esim-copy-soft)]">
              {t({ en: `~${outcome.estimatedGb} GB needed`, hans: `预计需要 ~${outcome.estimatedGb} GB`, hant: `預計需要 ~${outcome.estimatedGb} GB` })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onViewPlan(rec.product)}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--esim-gold)] px-4 py-3 text-sm font-semibold text-black hover:bg-[var(--esim-gold-strong)]"
          >
            {t({ en: 'View coverage & plans', hans: '查看覆盖与套餐', hant: '查看覆蓋與套餐' })}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {attrs.hotspot === false && draftHotspotNote(locale)}
          {outcome.alternatives.length > 0 && (
            <>
              <button type="button" onClick={() => setShowAlternatives((value) => !value)} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 text-sm text-[var(--esim-copy)] hover:text-[var(--esim-gold-strong)]">
                {showAlternatives
                  ? t({ en: 'Hide other plans', hans: '收起其他套餐', hant: '收起其他套餐' })
                  : t({ en: `View other plans (${outcome.alternatives.length})`, hans: `查看其他可用套餐（${outcome.alternatives.length}）`, hant: `查看其他可用套餐（${outcome.alternatives.length}）` })}
                {showAlternatives ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              </button>
              {showAlternatives && (
                <ul className="mt-2 space-y-2">
                  {outcome.alternatives.map((alt) => (
                    <li key={alt.product.id}>
                      <button type="button" onClick={() => onViewPlan(alt.product)} className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[rgba(255,255,255,0.1)] px-3.5 py-2.5 text-left text-sm hover:border-[rgba(212,175,55,0.35)]">
                        <span className="text-[var(--esim-copy)]">
                          {alt.product.name}
                          {alt.gb !== null ? ` · ${alt.gb}GB` : ''}
                          {alt.validityDays !== null ? ` · ${alt.validityDays}${t({ en: 'd', hans: '天', hant: '天' })}` : ''}
                        </span>
                        <span className="font-semibold text-[var(--esim-gold)]">${alt.price}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <CoverageDetails outcome={outcome} locale={locale} />
      </div>
    );
  }

  if (outcome.status === 'partial') {
    return (
      <div aria-live="polite">
        <div className={`rounded-2xl border border-[rgba(255,170,0,0.35)] bg-[#141414] p-5`}>
          <span className="rounded border border-[rgba(255,170,0,0.4)] px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-orange-300">
            {t({ en: 'No single plan covers the trip', hans: '没有单张 eSIM 覆盖全程', hant: '沒有單張 eSIM 覆蓋全程' })}
          </span>
          <p className="mt-3 text-sm text-[var(--esim-copy)]">
            {t({
              en: 'Buy the trip in segments — one eSIM per segment below.',
              hans: '可按分段购买——以下每段一张 eSIM。',
              hant: '可按分段購買——以下每段一張 eSIM。',
            })}
          </p>
          <ul className="mt-3 space-y-2">
            {outcome.segments.map((segment) => (
              <li key={segment.code}>
                <button type="button" onClick={() => onViewPlan(segment.product)} className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[rgba(255,255,255,0.1)] px-3.5 py-2.5 text-left text-sm hover:border-[rgba(212,175,55,0.35)]">
                  <span className="text-[var(--esim-copy)]">
                    {destinationLabel(segment.code, locale)} · {segment.product.name}
                  </span>
                  <span className="font-semibold text-[var(--esim-gold)]">${segment.price}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--esim-copy-soft)]">
            {t({ en: `${outcome.segments.length} eSIMs to install for the full trip.`, hans: `全程需安装 ${outcome.segments.length} 张 eSIM。`, hant: `全程需安裝 ${outcome.segments.length} 張 eSIM。` })}
          </p>
        </div>
        <CoverageDetails outcome={outcome} locale={locale} />
      </div>
    );
  }

  // no-match
  const missingCodes = outcome.gaps.find((gap) => gap.kind === 'missing-coverage')?.codes || [];
  return (
    <div className={`rounded-2xl border ${HAIRLINE} bg-[#141414] p-5`} aria-live="polite">
      <span className="rounded border border-[rgba(255,255,255,0.2)] px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-[var(--esim-copy)]">
        {t({ en: 'No matching plan yet', hans: '暂无匹配套餐', hant: '暫無匹配套餐' })}
      </span>
      <ul className="mt-3 space-y-1.5 text-sm text-[var(--esim-copy)]">
        {missingCodes.map((code) => (
          <li key={code}>
            {t({ en: `${destinationLabel(code, locale)} is not covered by current plans.`, hans: `当前套餐不覆盖${destinationLabel(code, 'zh-Hans')}。`, hant: `當前套餐不覆蓋${destinationLabel(code, 'zh-Hant')}。` })}
          </li>
        ))}
        {outcome.gaps.some((gap) => gap.kind === 'validity-short') && (
          <li>{t({ en: 'Plan validity is shorter than the trip span.', hans: '套餐有效期短于行程跨度。', hant: '套餐有效期短於行程跨度。' })}</li>
        )}
        {outcome.gaps.some((gap) => gap.kind === 'hotspot-unavailable') && (
          <li>{t({ en: 'Required hotspot sharing is not confirmed on current plans.', hans: '所需的热点共享在当前套餐未确认。', hant: '所需的熱點共享在當前套餐未確認。' })}</li>
        )}
      </ul>
      <p className="mt-3 text-xs text-[var(--esim-copy-soft)]">
        {t({ en: 'Adjust the route, or browse sellable destinations.', hans: '可调整路线，或浏览可售目的地。', hant: '可調整路線，或瀏覽可售目的地。' })}
      </p>
      <button type="button" onClick={onChooseDestinations} className="mt-4 min-h-[44px] w-full rounded-xl border border-[rgba(212,175,55,0.45)] px-4 py-2.5 text-sm text-[var(--esim-gold-strong)] hover:bg-[rgba(212,175,55,0.08)]">
        {t({ en: 'Review destinations', hans: '查看目的地', hant: '查看目的地' })}
      </button>
    </div>
  );
}

function draftHotspotNote(locale?: string): React.ReactNode {
  const t = (copy: { en: string; hans: string; hant: string }) => {
    if (locale === 'zh-Hant') return copy.hant;
    if (locale && locale.startsWith('zh')) return copy.hans;
    return copy.en;
  };
  return (
    <p className="mt-2 text-xs text-[var(--esim-copy-soft)]">
      {t({ en: 'This plan does not confirm hotspot sharing.', hans: '该套餐未确认支持热点共享。', hant: '該套餐未確認支持熱點共享。' })}
    </p>
  );
}

/* ---------------- Coverage details (PRD §5.4) ---------------- */

function CoverageDetails({ outcome, locale }: { outcome: MatchOutcome; locale?: string }) {
  const t = useCopy(locale);
  const rec = outcome.recommendation;
  const attrs = rec?.attributes;
  const [open, setOpen] = React.useState(false);

  return (
    <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-sm text-[var(--esim-copy)] hover:text-[var(--esim-ink)]"
      >
        {t({ en: 'Coverage detail by stop', hans: '覆盖明细（按站点）', hant: '覆蓋明細（按站點）' })}
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && (
        <div className="border-t border-[rgba(255,255,255,0.08)] px-4 py-3">
          <dl className="space-y-2.5 text-sm">
            {attrs?.carriers && Object.keys(attrs.carriers).length > 0
              ? Object.entries(attrs.carriers).map(([code, carrier]) => (
                  <div key={code} className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--esim-copy)]">{destinationLabel(code, locale)}</dt>
                    <dd className="text-right text-xs text-[var(--esim-copy-soft)]">
                      {carrier}
                      {attrs.networks?.technology?.length ? ` · ${attrs.networks.technology.join('/')}` : ''}
                    </dd>
                  </div>
                ))
              : (rec?.coverageCodes || []).map((code) => (
                  <div key={code} className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--esim-copy)]">{destinationLabel(code, locale)}</dt>
                    <dd className="text-right text-xs text-[var(--esim-copy-soft)]">
                      {attrs?.networks?.technology?.join('/') || '4G / LTE'}
                    </dd>
                  </div>
                ))}
            {outcome.segments.map((segment) => (
              <div key={`seg-${segment.code}`} className="flex items-center justify-between gap-3">
                <dt className="text-[var(--esim-copy)]">{destinationLabel(segment.code, locale)}</dt>
                <dd className="text-right text-xs text-[var(--esim-copy-soft)]">{segment.product.name}</dd>
              </div>
            ))}
          </dl>
          {attrs?.fairUse && (
            <p className="mt-3 border-t border-[rgba(255,255,255,0.08)] pt-2.5 text-xs text-[var(--esim-copy-soft)]">{attrs.fairUse}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Orchestrator ---------------- */

export function RoutePlanner({
  locale,
  config,
  onNavigate,
}: {
  locale?: string;
  config?: ThemeConfig;
  onNavigate?: (path: string) => void;
}) {
  const site = resolveEsimSiteConfig(config, locale);
  const t = useCopy(locale);

  const [draft, setDraft] = React.useState<RouteDraft>(createEmptyDraft);
  const [draftRestored, setDraftRestored] = React.useState(false);
  const [products, setProducts] = React.useState<EsimApiProduct[]>([]);
  const [catalogState, setCatalogState] = React.useState<CatalogState>('loading');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerMode, setPickerMode] = useState<{ mode: 'batch' } | { mode: 'replace'; stopId: string }>({ mode: 'batch' });
  const [staged, setStaged] = React.useState<string[]>([]);

  const loadCatalog = React.useCallback(() => {
    setCatalogState('loading');
    (async () => {
      try {
        const response = await getEsimProducts({ baseUrl: site.apiBaseUrl }, { limit: 50, locale: locale || 'en' });
        setProducts(response.items || []);
        setCatalogState('ready');
      } catch {
        setCatalogState('error');
      }
    })();
  }, [site.apiBaseUrl, locale]);

  React.useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  React.useEffect(() => {
    const restored = loadDraft();
    if (restored && restored.stops.length > 0) setDraft(restored);
    setDraftRestored(true);
  }, []);

  const catalog = React.useMemo(() => buildDestinationCatalog(products), [products]);
  const outcome = React.useMemo(() => matchRoute(draft, products), [draft, products]);

  const mutate = React.useCallback((fn: (draft: RouteDraft) => void) => {
    setDraft((prev) => {
      const next = cloneDraft(prev);
      fn(next);
      next.version = prev.version + 1;
      saveDraft(next);
      return next;
    });
  }, []);

  const openBatchPicker = React.useCallback(() => {
    setPickerMode({ mode: 'batch' });
    setStaged([]);
    setPickerOpen(true);
  }, []);

  const openReplacePicker = React.useCallback((stopId: string) => {
    setPickerMode({ mode: 'replace', stopId });
    setStaged([]);
    setPickerOpen(true);
  }, []);

  const toggleStaged = React.useCallback((code: string) => {
    setStaged((prev) => (prev.includes(code) ? prev.filter((value) => value !== code) : [...prev, code]));
  }, []);

  const confirmPicker = React.useCallback(() => {
    if (pickerMode.mode === 'batch') {
      mutate((next) => {
        for (const code of staged) {
          next.stops.push({ id: nextStopId(), code, days: 1 });
        }
      });
    } else {
      const stopId = pickerMode.stopId;
      mutate((next) => {
        const stop = next.stops.find((candidate) => candidate.id === stopId);
        if (stop && staged[0]) stop.code = staged[0];
      });
    }
    setPickerOpen(false);
    setStaged([]);
  }, [mutate, pickerMode, staged]);

  const loadExample = React.useCallback(() => {
    mutate((next) => {
      next.usageMode = 'mapChat';
      next.hotspot = false;
      next.stops = EXAMPLE_TRIP_STOPS.map((stop) => ({ id: nextStopId(), code: stop.code, days: stop.days }));
    });
  }, [mutate]);

  const viewPlan = React.useCallback(
    (product: EsimApiProduct) => {
      const slug = product.slug || product.id;
      onNavigate?.(`/products/${slug}`);
    },
    [onNavigate]
  );

  void draftRestored;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <RouteEditor
          draft={draft}
          locale={locale}
          onDaysChange={(stopId, days) => mutate((next) => {
            const stop = next.stops.find((candidate) => candidate.id === stopId);
            if (stop) stop.days = Math.max(1, Math.floor(days));
          })}
          onMove={(stopId, direction) => mutate((next) => {
            const index = next.stops.findIndex((candidate) => candidate.id === stopId);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= next.stops.length) return;
            const [moved] = next.stops.splice(index, 1);
            next.stops.splice(target, 0, moved);
          })}
          onRemove={(stopId) => mutate((next) => {
            next.stops = next.stops.filter((candidate) => candidate.id !== stopId);
          })}
          onAddStop={openBatchPicker}
          onReplaceStop={openReplacePicker}
          onUsageMode={(mode) => mutate((next) => {
            next.usageMode = mode;
          })}
          onHotspotToggle={(enabled) => mutate((next) => {
            next.hotspot = enabled;
          })}
        />
      </div>
      <div className="lg:col-span-5">
        <RecommendationCard
          outcome={outcome}
          locale={locale}
          catalogState={catalogState}
          onRetryCatalog={loadCatalog}
          onViewPlan={viewPlan}
          exampleAvailable
          onExample={loadExample}
          onChooseDestinations={openBatchPicker}
        />
      </div>

      <DestinationPicker
        open={pickerOpen}
        locale={locale}
        catalog={catalog}
        staged={staged}
        onToggle={toggleStaged}
        onConfirm={confirmPicker}
        onCancel={() => {
          setPickerOpen(false);
          setStaged([]);
        }}
        singleMode={pickerMode.mode === 'replace'}
      />
    </div>
  );
}

function useState<T>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  return React.useState<T>(initial);
}

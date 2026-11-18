import type { EsimApiProduct } from '../api';
import { planCoverageCodes, planPrice, readPlanAttributes } from './catalog';
import { estimateUsageGb, tripDestinations, tripSpanDays, type RouteDraft } from './itinerary';

/**
 * Deterministic route matcher — zero model calls (PRD §1/§10: 普通用户浏览、
 * 国家搜索、路线匹配、推荐解释均为零模型调用；推荐理由使用模板).
 *
 * Pipeline (PRD §6): hard-condition filter → usage-adequate price-ascending
 * sort → single best recommendation. Gaps and segment fallbacks explain any
 * failure with concrete, template-rendered reasons.
 */

export const MATCH_RULES_VERSION = 'route-matcher-v1';

export interface MatchResultRouteMeta {
  routeVersion: number;
  catalogVersion: string; // product catalog snapshot marker
  rulesVersion: string;
  usageProfilesVersion: string;
}

export type GapKind = 'missing-coverage' | 'validity-short' | 'data-short' | 'hotspot-unavailable' | 'not-saleable';

export interface MatchGap {
  kind: GapKind;
  /** ISO codes the plan fails on, when gap is per-stop. */
  codes?: string[];
  /** Human-readable template params. */
  detail?: string;
}

export interface PlanRecommendation {
  product: EsimApiProduct;
  price: number;
  currency: string;
  gb: number | null;
  validityDays: number | null;
  coverageCodes: string[];
  attributes: ReturnType<typeof readPlanAttributes>;
  /** Verified flags rendered as 核验标签 (PRD §5.4). */
  verified: {
    allDestinationsCovered: boolean;
    validityCoversSpan: boolean;
    dataMeetsEstimate: boolean;
    hotspotConfirmed: boolean;
  };
}

export interface MatchOutcome {
  meta: MatchResultRouteMeta;
  status: 'empty-route' | 'full-plan' | 'partial' | 'no-match';
  /** Best single-plan recommendation (full coverage). */
  recommendation: PlanRecommendation | null;
  /** Additional single plans meeting hard conditions (查看其他可用套餐). */
  alternatives: PlanRecommendation[];
  /** Template explanations for why candidates were rejected (PRD §6.3). */
  gaps: MatchGap[];
  /** Per-stop segment fallback when no single plan covers everything. */
  segments: Array<{ code: string; product: EsimApiProduct; price: number; currency: string }>;
  estimatedGb: number;
}

function saleable(product: EsimApiProduct): boolean {
  // Product DTOs carry no isActive flag; a plan is saleable when it has a
  // positive price (variant sale price or product price).
  return planPrice(product) > 0;
}

function planGb(product: EsimApiProduct): number | null {
  const gb = readPlanAttributes(product).data?.gb;
  return typeof gb === 'number' && gb > 0 ? gb : null;
}

function planValidityDays(product: EsimApiProduct): number | null {
  const days = readPlanAttributes(product).validityDays;
  return typeof days === 'number' && days > 0 ? days : null;
}

function toRecommendation(product: EsimApiProduct, draft: RouteDraft, estimatedGb: number): PlanRecommendation {
  const attributes = readPlanAttributes(product);
  const coverage = planCoverageCodes(product);
  const validity = planValidityDays(product);
  const gb = planGb(product);
  return {
    product,
    price: planPrice(product),
    currency: product.currency || 'USD',
    gb,
    validityDays: validity,
    coverageCodes: coverage,
    attributes,
    verified: {
      allDestinationsCovered: tripDestinations(draft).every((code) => coverage.includes(code)),
      validityCoversSpan: validity !== null && validity >= tripSpanDays(draft),
      dataMeetsEstimate: gb !== null && gb >= estimatedGb,
      hotspotConfirmed: attributes.hotspot === true,
    },
  };
}

function currencyOf(product: EsimApiProduct): string {
  return product.currency || 'USD';
}

/**
 * Match a route draft against the product catalog.
 * Pure function — same draft + same catalog snapshot ⇒ same outcome.
 */
export function matchRoute(
  draft: RouteDraft,
  products: EsimApiProduct[],
  options: { catalogVersion?: string } = {},
): MatchOutcome {
  const estimatedGb = estimateUsageGb(draft);
  const span = tripSpanDays(draft);
  const destinations = tripDestinations(draft);
  const meta: MatchResultRouteMeta = {
    routeVersion: draft.version,
    catalogVersion: options.catalogVersion || 'catalog-unversioned',
    rulesVersion: MATCH_RULES_VERSION,
    usageProfilesVersion: 'usage-profiles-v1',
  };

  if (draft.stops.length === 0) {
    return { meta, status: 'empty-route', recommendation: null, alternatives: [], gaps: [], segments: [], estimatedGb };
  }

  const candidates = products.filter(saleable);
  const survivors: EsimApiProduct[] = [];
  const gaps: MatchGap[] = [];
  const hotspotRequired = draft.hotspot;

  for (const product of candidates) {
    const coverage = planCoverageCodes(product);
    const missing = destinations.filter((code) => !coverage.includes(code));
    const validity = planValidityDays(product);
    const gb = planGb(product);
    const attributes = readPlanAttributes(product);

    if (missing.length > 0) {
      if (missing.length < destinations.length) {
        gaps.push({ kind: 'missing-coverage', codes: missing });
      }
      continue;
    }
    if (validity !== null && validity < span) {
      gaps.push({ kind: 'validity-short', detail: `${validity}d < ${span}d` });
      continue;
    }
    if (hotspotRequired && attributes.hotspot !== true) {
      gaps.push({ kind: 'hotspot-unavailable' });
      continue;
    }
    // Data vs estimate: soft-hard — plans below the estimate are still
    // eligible as fallback but sort behind adequate ones and surface a
    // data-short explanation when they end up as the only options.
    if (gb !== null && gb < estimatedGb) {
      gaps.push({ kind: 'data-short', detail: `${gb}GB < ~${estimatedGb}GB` });
    }
    survivors.push(product);
  }

  const adequate = survivors.filter((product) => {
    const gb = planGb(product);
    return gb !== null && gb >= estimatedGb;
  });
  const pool = adequate.length > 0 ? adequate : survivors;

  // PRD §6.2: ascending actual total price; ties prefer more validity, then more data.
  pool.sort((a, b) => {
    const priceDelta = planPrice(a) - planPrice(b);
    if (priceDelta !== 0) return priceDelta;
    const validityDelta = (planValidityDays(b) || 0) - (planValidityDays(a) || 0);
    if (validityDelta !== 0) return validityDelta;
    return (planGb(b) || 0) - (planGb(a) || 0);
  });

  const recommendations = pool.map((product) => toRecommendation(product, draft, estimatedGb));
  const recommendation = recommendations[0] || null;

  // Segment fallback (PRD §6.3): cheapest per-stop plan meeting that stop's
  // days validity, so users can buy the trip stop by stop.
  const segments: MatchOutcome['segments'] = [];
  if (!recommendation) {
    for (const code of destinations) {
      const stopDays = draft.stops
        .filter((stop) => stop.code === code)
        .reduce((sum, stop) => sum + Math.max(1, stop.days), 0);
      const perStop = candidates
        .filter((product) => planCoverageCodes(product).includes(code))
        .filter((product) => {
          const validity = planValidityDays(product);
          return validity === null || validity >= stopDays;
        })
        .sort((a, b) => planPrice(a) - planPrice(b))[0];
      if (perStop) {
        segments.push({ code, product: perStop, price: planPrice(perStop), currency: currencyOf(perStop) });
      }
    }
  }

  const status: MatchOutcome['status'] = recommendation
    ? 'full-plan'
    : segments.length === destinations.length
      ? 'partial'
      : 'no-match';

  return { meta, status, recommendation, alternatives: recommendations.slice(1, 4), gaps, segments, estimatedGb };
}

import { getApiServiceBaseUrl } from 'shared';
import type { AffiliateScope, AffiliateScopeMode } from '@/lib/hooks/use-api';

/**
 * The decisions of the affiliate workspace that need no screen: what a partner's code applies to, whether
 * that changed, and what the store asks for when it opens an organization itself.
 */

export type AffiliateScopeProduct = { id: string; name: string; price?: number | null; productKind?: string | null; requiresShipping?: boolean };

export type PartnerScopeEdit = { scopeMode: AffiliateScopeMode; scopeProductIds: string[] };

/** A row written before scopes existed applies to everything. */
export function affiliateScopeMode(value: unknown): AffiliateScopeMode {
  return value === 'selected' || value === 'except' ? value : 'all';
}

export function scopeProductIdsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function affiliateScopeSummary(mode: AffiliateScopeMode, productIds: string[]): string {
  if (mode === 'all') return 'All products';
  return mode === 'selected' ? `Only ${productIds.length} picked` : `All but ${productIds.length}`;
}

/** A card that is shipped: `goods` in the catalog, or anything marked as needing shipping. */
export function isPhysicalProduct(product: AffiliateScopeProduct): boolean {
  return product.productKind === 'goods' || product.requiresShipping === true;
}

function sameSelection(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/**
 * What to send the core for a partner's scope: nothing when it did not change, `invalid` when a code that
 * does not apply to everything names no product (the core would refuse it too).
 */
export function partnerScopeChange(
  edit: PartnerScopeEdit,
  saved: { scope_mode?: unknown; scope_product_ids?: unknown } | undefined,
): { scope?: AffiliateScope; invalid: boolean } {
  if (edit.scopeMode !== 'all' && edit.scopeProductIds.length === 0) return { invalid: true };
  // no row to compare with (the partner is gone): nothing to send
  const changed = saved != null
    && (edit.scopeMode !== affiliateScopeMode(saved.scope_mode)
      || !sameSelection(edit.scopeProductIds, scopeProductIdsOf(saved.scope_product_ids)));
  if (!changed) return { invalid: false };
  return { scope: { mode: edit.scopeMode, productIds: edit.scopeMode === 'all' ? [] : edit.scopeProductIds }, invalid: false };
}

/** Adds or removes a whole group (every physical card, every plan) from a selection, keeping its order. */
export function toggleGroup(productIds: string[], products: AffiliateScopeProduct[], match: (product: AffiliateScopeProduct) => boolean): string[] {
  const group = new Set(products.filter(match).map((product) => product.id));
  const allPicked = group.size > 0 && [...group].every((id) => productIds.includes(id));
  return allPicked
    ? productIds.filter((id) => !group.has(id))
    : [...productIds.filter((id) => !group.has(id)), ...group];
}

/** The request that opens an organization: the owner is an account id, or the e-mail of an account. */
export function newOrganizationPayload(
  input: { name: string; owner: string; rate: string },
): { payload: { name: string; ownerUserId?: string; ownerEmail?: string; commissionRate: number } } | { error: string } {
  const name = input.name.trim();
  const owner = input.owner.trim();
  const rate = Number(input.rate);
  if (name.length < 2) return { error: 'Give the organization a name of at least two characters.' };
  if (!owner) return { error: 'Give the organization its owner: an account id or an e-mail address.' };
  // an emptied field is not a rate of zero
  if (!input.rate.trim() || !Number.isFinite(rate) || rate < 0 || rate > 90) return { error: 'The organization rate must be between 0 and 90.' };
  return { payload: { name, ...(owner.includes('@') ? { ownerEmail: owner.toLowerCase() } : { ownerUserId: owner }), commissionRate: rate } };
}

/** Where the screenshot of an applicant's follower counts is read, with the administrator's session. */
export function affiliateScreenshotUrl(id: string): string {
  const base = String(getApiServiceBaseUrl() || '').replace(/\/$/, '');
  return `${base}/extensions/plugin/affiliate/api/admin/applications/${encodeURIComponent(id)}/screenshot`;
}

/** What the store's answer about that screenshot means for the page. */
export function screenshotOutcome(status: number): 'shown' | 'none' | 'failed' {
  if (status === 404) return 'none';
  return status >= 200 && status < 300 ? 'shown' : 'failed';
}

/**
 * Data-fed detail pages of the active theme
 * (theme.json → `x-jiffoo-seo.dynamicPages`).
 *
 * A theme that renders thousands of detail pages from its own feed — a game
 * catalog, say — declares where the feed lives. The host reads it for the
 * sitemap and for each page's title and description, so neither needs
 * per-page code. Feeds are fetched server-side and kept per isolate for ten
 * minutes; a feed that cannot be read contributes no items and never fails
 * the page that asked for it.
 */
import type { ThemeDynamicPage } from 'shared/src/types/theme';
import { getDeclaredThemeDynamicPages } from '@/lib/themes/theme-seo';

const FEED_TTL_MS = 10 * 60 * 1000;
/** A feed that failed to load is not asked again at once: every page would retry it. */
const FEED_RETRY_MS = 60 * 1000;
const FEED_TIMEOUT_MS = 8_000;
/** Same ceiling as the product surface, so one theme cannot make the sitemap unbounded. */
const MAX_ITEMS_PER_PAGE = 5000;

type Item = Record<string, unknown>;

const feeds = new Map<string, { document: unknown; fetchedAt: number }>();
const inflight = new Map<string, Promise<void>>();

/** The theme whose pages apply on this deployment: the active theme, else the pinned or fallback slug. */
export function dynamicPagesThemeSlug(activeThemeSlug?: string | null): string | undefined {
  const slug = activeThemeSlug || process.env.THEME_SLUG_PIN || process.env.NEXT_PUBLIC_FALLBACK_THEME_SLUG;
  return slug?.trim() || undefined;
}

/** The detail pages the active theme declares; empty when it declares none. */
export function declaredDynamicPages(activeThemeSlug?: string | null): readonly ThemeDynamicPage[] {
  const slug = dynamicPagesThemeSlug(activeThemeSlug);
  return slug ? getDeclaredThemeDynamicPages(slug) : [];
}

function readItems(document: unknown, itemsPath?: string): Item[] {
  let node: unknown = document;
  for (const key of itemsPath ? itemsPath.split('.') : []) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined;
  }
  return Array.isArray(node)
    ? node.filter((entry): entry is Item => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    : [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Where a feed is read from: a source that is a path on this storefront is resolved against its origin. */
export function feedUrl(source: string, origin: string): string {
  return new URL(source, origin).toString();
}

async function refreshFeed(url: string): Promise<void> {
  const previous = feeds.get(url)?.document;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS), headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`feed ${url} answered ${response.status}`);
    const document: unknown = await response.json();
    feeds.set(url, { document, fetchedAt: Date.now() });
  } catch {
    // Keep serving what was read before, if any, and count the failure as a load
    // that stays fresh for a minute — so the feed is neither hammered nor
    // retried on every page until it answers again.
    feeds.set(url, { document: previous, fetchedAt: Date.now() - FEED_TTL_MS + FEED_RETRY_MS });
  }
}

async function loadFeed(source: string, origin: string): Promise<unknown> {
  const url = feedUrl(source, origin);
  const cached = feeds.get(url);
  if (cached && Date.now() - cached.fetchedAt < FEED_TTL_MS) return cached.document;
  let pending = inflight.get(url);
  if (!pending) {
    pending = refreshFeed(url).finally(() => inflight.delete(url));
    inflight.set(url, pending);
  }
  await pending;
  return feeds.get(url)?.document;
}

/** The items of one declared page, every source merged; empty when no source can be read. */
export async function loadDynamicPageItems(page: ThemeDynamicPage, origin: string): Promise<Item[]> {
  const documents = await Promise.all(page.sources.map((source) => loadFeed(source, origin)));
  return documents.flatMap((document) => readItems(document, page.items)).slice(0, MAX_ITEMS_PER_PAGE);
}

/**
 * The path of one item's page. Each `:name` segment of the declared path is
 * filled from the item field of that name; an item that lacks a value for any
 * of them has no page.
 */
export function dynamicPagePath(page: ThemeDynamicPage, item: Item): string | null {
  let complete = true;
  const segments = page.path.split('/').map((segment) => {
    if (!segment.startsWith(':')) return segment;
    const value = item[segment.slice(1)];
    if (typeof value !== 'string' && typeof value !== 'number' || String(value) === '') complete = false;
    return encodeURIComponent(String(value));
  });
  return complete ? segments.join('/') : null;
}

/** The value that identifies an item in URLs, or null when the item has none. */
export function dynamicPageItemId(page: ThemeDynamicPage, item: Item): string | null {
  const value = item[page.idField];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** Title and description of one item's page, from the fields the theme names (defaulting to `title` and `description`). */
export function dynamicPageCopy(page: ThemeDynamicPage, item: Item): { title?: string; description?: string } {
  return {
    title: text(item[page.titleField ?? 'title']),
    description: text(item[page.descriptionField ?? 'description']),
  };
}

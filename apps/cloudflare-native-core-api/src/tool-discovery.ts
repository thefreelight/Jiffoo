// Tool discovery intake: automated collection of trending AI tools from
// public sources, reviewed by administrators before they join the public
// catalog. Collection appends candidate rows to `tool_discoveries`; approval
// builds a catalog product and rewrites the public catalog snapshots exactly
// like the odoo catalog sync, so storefront reads stay D1-authoritative.
//
// Sources:
// - Hacker News (Algolia API, public, no auth): recent Show HN stories that
//   match the AI keyword filter with a minimum score.

import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

type ToolDiscoveryEnv = NativeAuthEnv & {
  DB: D1Database;
  GITHUB_TOKEN?: string;
  TOOL_DISCOVERY_ENABLED?: string;
};

type DiscoveryStatus = 'pending' | 'approved' | 'rejected' | 'duplicate';

interface DiscoveryRow {
  id: string;
  source: string;
  source_id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  url: string | null;
  domain: string | null;
  metrics_json: string;
  keywords_json: string;
  status: DiscoveryStatus;
  product_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  discovered_at: string;
  created_at: string;
  updated_at: string;
}

interface DiscoveryCandidate {
  source: string;
  sourceId: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  metrics: Record<string, number | string>;
  keywords: string[];
  discoveredAt: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number | null;
  sku: string;
  category: {
    id: string;
    name: string;
    slug: string;
    description: string;
    image: string;
    parentId: string;
    level: number;
    isActive: boolean;
    productCount: number;
  };
  tags: string[];
  images: unknown[];
  variants: unknown[];
  inventory: {
    quantity: number;
    reserved: number;
    available: number;
    lowStockThreshold: number;
    isInStock: boolean;
    isLowStock: boolean;
    trackInventory: boolean;
  };
  specifications: unknown[];
  isActive: boolean;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  typeData: { websiteUrl?: string };
}

interface CatalogListEnvelope {
  data?: { items?: CatalogProduct[] };
}

const DISCOVERY_RUNTIME = 'cloudflare-native-d1-tool-discovery';
const CATALOG_SNAPSHOT_KEY = 'core:snapshot:/api/v1/products';
const LOOKBACK_DAYS = 3;
const HN_MIN_POINTS = 10;
const HN_MAX_ITEMS = 25;
const GITHUB_TOPICS = ['ai', 'llm', 'chatbot', 'ai-agents'];
const GITHUB_MIN_STARS = 50;
const GITHUB_MAX_ITEMS = 20;
const HF_MAX_ITEMS = 20;
// Hosts that serve many distinct tools under one domain. Dedupe for these
// falls back to the full URL instead of the domain, and the same-host guard
// in catalog dedupe must not retire siblings of unrelated projects.
const SHARED_HOSTS = new Set(['github.com', 'huggingface.co']);
const MAX_CANDIDATES_PER_RUN = 30;

// Tokens matched against story/post titles to keep the queue on-topic.
const AI_KEYWORD_RE =
  /\b(ai|a\.i\.|gpt|llm|llms|chatbot|claude|gemini|copilot|midjourney|sora|diffusion|openai|anthropic|mistral|llama|agent|agents|rag|prompt|mcp|text-to-(image|video|speech)|voice (agent|clone)|image generation|machine learning)\b/i;

function nowIso(): string {
  return new Date().toISOString();
}

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'tool';
}

export function matchesAiKeywords(title: string): boolean {
  return AI_KEYWORD_RE.test(title);
}

export function cleanShowHnTitle(title: string): string {
  return title.replace(/^show\s*hn[\s:]+/i, '').trim() || title.trim();
}

// News and social domains publish AI coverage, not tools. Their stories pass
// the keyword filter easily but never belong in a tool directory queue.
const NEWS_DOMAIN_BLOCKLIST = new Set([
  'wsj.com', 'arstechnica.com', 'techcrunch.com', 'theverge.com', 'engadget.com',
  'gizmodo.com', 'wired.com', 'venturebeat.com', 'zdnet.com', 'theregister.com',
  'nytimes.com', 'washingtonpost.com', 'bloomberg.com', 'cnbc.com', 'ft.com',
  'economist.com', 'bbc.com', 'cnn.com', 'forbes.com', 'businessinsider.com',
  'theinformation.com', 'news.ycombinator.com', 'twitter.com', 'x.com',
  'reddit.com', 'youtube.com', 'medium.com', 'substack.com', 'facebook.com',
  'linkedin.com', 'instagram.com', 'tiktok.com',
]);

// Headline shapes that indicate news coverage or essays rather than a tool
// release: security incidents, lawsuits, opinion pieces, how-to essays.
const NEWS_TITLE_RE =
  /\b(hackers?|breach(ed|es)?|vulnerabilit(y|ies)|rce|zero[- ]click|misconfiguration|attack|exploit(ed)?|malware|backdoor|outage|lawsuits?|sues?|sued|fights?|loses?|lost (to|fight)|case against|apocalypse|doom|banned?|crackdown)\b/i;

export function looksLikeNewsDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  if (NEWS_DOMAIN_BLOCKLIST.has(normalized)) return true;
  // Second-level news domains (e.g. ft.com syndicates, country TLDs).
  return [...NEWS_DOMAIN_BLOCKLIST].some((blocked) => normalized.endsWith(`.${blocked}`));
}

export function looksLikeNewsTitle(title: string): boolean {
  return NEWS_TITLE_RE.test(title) || /^(how|why)\s+(to|i|we|the)\b/i.test(title);
}

export function isToolCandidate(title: string, url: string | null | undefined): boolean {
  if (!matchesAiKeywords(title)) return false;
  if (looksLikeNewsTitle(title)) return false;
  if (looksLikeNewsDomain(extractDomain(url))) return false;
  return true;
}

// Dedupe key: the tool's own domain, or the full URL on shared hosts where
// many unrelated tools live under one domain.
export function dedupeKey(url: string | null | undefined): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  if (SHARED_HOSTS.has(domain) && url) {
    try {
      return new URL(url).toString().replace(/\/+$/, '').toLowerCase();
    } catch {
      return domain;
    }
  }
  return domain;
}

interface HnHit {  objectID: string;
  title?: string;
  url?: string | null;
  points?: number;
  num_comments?: number;
  created_at_i?: number;
}

export async function collectHackerNewsCandidates(
  fetchImpl: typeof fetch,
  now = new Date(),
): Promise<DiscoveryCandidate[]> {
  const sinceSeconds = Math.floor((now.getTime() - LOOKBACK_DAYS * 86400_000) / 1000);
  const endpoint =
    'https://hn.algolia.com/api/v1/search_by_date?tags=%28story%2Cshow_hn%29' +
    `&numericFilters=${encodeURIComponent(`created_at_i>${sinceSeconds},points>=${HN_MIN_POINTS}`)}` +
    `&hitsPerPage=60`;
  const response = await fetchImpl(endpoint, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`hn_algolia_${response.status}`);
  const body = await response.json() as { hits?: HnHit[] };
  const hits = Array.isArray(body.hits) ? body.hits : [];
  const candidates: DiscoveryCandidate[] = [];
  for (const hit of hits) {
    const rawTitle = (hit.title ?? '').trim();
    if (!rawTitle) continue;
    const url = (hit.url ?? '').trim() || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    if (!isToolCandidate(rawTitle, url)) continue;
    const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    candidates.push({
      source: 'hacker_news',
      sourceId: hit.objectID,
      name: cleanShowHnTitle(rawTitle).slice(0, 160),
      tagline: 'Show HN',
      description: rawTitle,
      url,
      metrics: { points: hit.points ?? 0, comments: hit.num_comments ?? 0 },
      keywords: ['show hn'],
      discoveredAt: hit.created_at_i
        ? new Date(hit.created_at_i * 1000).toISOString()
        : now.toISOString(),
    });
    if (candidates.length >= HN_MAX_ITEMS) break;
  }
  return candidates;
}

interface GhRepo {
  full_name: string;
  name?: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  created_at: string;
}

export async function collectGitHubCandidates(
  fetchImpl: typeof fetch,
  now = new Date(),
  token: string | null = null,
): Promise<DiscoveryCandidate[]> {
  const sinceDate = new Date(now.getTime() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10);
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'jiffoo-tool-discovery',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const topic of GITHUB_TOPICS) {
    if (candidates.length >= GITHUB_MAX_ITEMS) break;
    const q = encodeURIComponent(`created:>${sinceDate} topic:${topic} stars:>=${GITHUB_MIN_STARS}`);
    const endpoint = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`;
    const response = await fetchImpl(endpoint, { headers });
    if (!response.ok) throw new Error(`github_${response.status}`);
    const body = await response.json() as { items?: GhRepo[] };
    for (const repo of body.items ?? []) {
      if (seen.has(repo.full_name)) continue;
      seen.add(repo.full_name);
      const title = (repo.name ?? repo.full_name.split('/').pop() ?? repo.full_name).trim();
      if (!title || looksLikeNewsTitle(`${title} ${repo.description ?? ''}`)) continue;
      candidates.push({
        source: 'github',
        sourceId: repo.full_name,
        name: title.slice(0, 160),
        tagline: `GitHub topic:${topic}`,
        description: (repo.description ?? title).slice(0, 1000),
        url: repo.html_url,
        metrics: { stars: repo.stargazers_count ?? 0 },
        keywords: [`topic:${topic}`],
        discoveredAt: repo.created_at ?? now.toISOString(),
      });
      if (candidates.length >= GITHUB_MAX_ITEMS) break;
    }
  }
  return candidates;
}

interface HfSpace {
  id: string;
  likes?: number;
  trendingScore?: number;
}

export async function collectHuggingFaceCandidates(
  fetchImpl: typeof fetch,
  now = new Date(),
): Promise<DiscoveryCandidate[]> {
  const endpoint = 'https://huggingface.co/api/spaces?sort=trendingScore&direction=-1&limit=60';
  const response = await fetchImpl(endpoint, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`huggingface_${response.status}`);
  const spaces = await response.json() as HfSpace[];
  const candidates: DiscoveryCandidate[] = [];
  for (const space of Array.isArray(spaces) ? spaces : []) {
    if (!space?.id || !space.id.includes('/')) continue;
    const title = (space.id.split('/')[1] ?? space.id).replace(/[-_]+/g, ' ').trim();
    if (!title || looksLikeNewsTitle(title)) continue;
    candidates.push({
      source: 'hugging_face',
      sourceId: space.id,
      name: title.slice(0, 160),
      tagline: 'Hugging Face Spaces',
      description: title,
      url: `https://huggingface.co/spaces/${space.id}`,
      metrics: { likes: space.likes ?? 0 },
      keywords: ['hugging face'],
      discoveredAt: now.toISOString(),
    });
    if (candidates.length >= HF_MAX_ITEMS) break;
  }
  return candidates;
}

interface SnapshotRow {
  payload: string;
  status_code: number;
}

export async function readCatalogItems(env: ToolDiscoveryEnv): Promise<CatalogProduct[]> {
  const row = await env.DB.prepare(
    'SELECT payload, status_code FROM core_api_snapshots WHERE cache_key = ?1',
  ).bind(CATALOG_SNAPSHOT_KEY).first<SnapshotRow>();
  if (!row || row.status_code !== 200) return [];
  try {
    const envelope = JSON.parse(row.payload) as CatalogListEnvelope;
    return Array.isArray(envelope.data?.items) ? envelope.data.items : [];
  } catch {
    return [];
  }
}

function upsertSnapshotStatement(env: ToolDiscoveryEnv, path: string, body: string) {
  return env.DB.prepare(
    `INSERT INTO core_api_snapshots
      (cache_key, request_path, payload, status_code, content_type, source_updated_at, refreshed_at)
     VALUES (?1, ?2, ?3, 200, 'application/json; charset=utf-8', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, status_code = excluded.status_code,
       content_type = excluded.content_type, source_updated_at = excluded.source_updated_at, refreshed_at = CURRENT_TIMESTAMP`,
  ).bind(`core:snapshot:${path}`, path, body);
}

/** Merge a product into the public catalog snapshots (list + detail). */
export async function appendProductToCatalog(
  env: ToolDiscoveryEnv,
  product: CatalogProduct,
): Promise<number> {
  const items = await readCatalogItems(env);
  const next = [...items.filter((item) => item.id !== product.id), product];
  const listBody = JSON.stringify({
    success: true,
    data: { items: next, page: 1, limit: next.length, total: next.length, totalPages: 1 },
  });
  const detailBody = JSON.stringify({ success: true, data: product });
  await env.DB.batch([
    upsertSnapshotStatement(env, '/api/v1/products', listBody),
    upsertSnapshotStatement(env, `/api/v1/products/${encodeURIComponent(product.id)}`, detailBody),
  ]);
  return next.length;
}

async function upsertCandidates(env: ToolDiscoveryEnv, candidates: DiscoveryCandidate[]): Promise<number> {
  const items = await readCatalogItems(env);
  const catalogKeys = new Set(
    items
      .map((item) => dedupeKey(item.typeData?.websiteUrl))
      .filter((key): key is string => Boolean(key)),
  );
  const liveRows = await env.DB.prepare(
    "SELECT url FROM tool_discoveries WHERE status IN ('pending', 'approved') AND url IS NOT NULL",
  ).all<{ url: string | null }>();
  const liveKeys = new Set((liveRows.results ?? []).map((row) => dedupeKey(row.url)).filter((key): key is string => Boolean(key)));

  let inserted = 0;
  for (const candidate of candidates) {
    const domain = extractDomain(candidate.url);
    const dupKey = dedupeKey(candidate.url);
    const isDuplicate = (dupKey && (catalogKeys.has(dupKey) || liveKeys.has(dupKey))) ?? false;
    const result = await env.DB.prepare(
      `INSERT INTO tool_discoveries
        (id, source, source_id, name, tagline, description, url, domain, metrics_json, keywords_json,
         status, discovered_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)
       ON CONFLICT(source, source_id) DO UPDATE SET
         name = excluded.name, tagline = excluded.tagline, description = excluded.description,
         url = excluded.url, metrics_json = excluded.metrics_json, keywords_json = excluded.keywords_json,
         discovered_at = excluded.discovered_at, updated_at = excluded.updated_at
       WHERE tool_discoveries.status = 'pending'`,
    ).bind(
      crypto.randomUUID(),
      candidate.source,
      candidate.sourceId,
      candidate.name,
      candidate.tagline,
      candidate.description,
      candidate.url,
      domain,
      JSON.stringify(candidate.metrics),
      JSON.stringify(candidate.keywords),
      isDuplicate ? 'duplicate' : 'pending',
      candidate.discoveredAt,
      nowIso(),
    ).run();
    if (result.meta.changes > 0) inserted += 1;
    if (dupKey && !isDuplicate) liveKeys.add(dupKey);
  }
  return inserted;
}

export interface DiscoveryRunResult {
  sources: Array<{ source: string; inserted: number } | { source: string; skipped: string }>;
  totalInserted: number;
}

const heatOf = (candidate: DiscoveryCandidate): number =>
  Number(candidate.metrics.votes ?? candidate.metrics.likes ?? candidate.metrics.stars ?? candidate.metrics.points ?? 0);

export async function runNativeToolDiscovery(env: ToolDiscoveryEnv): Promise<DiscoveryRunResult> {
  const sources: DiscoveryRunResult['sources'] = [];
  let totalInserted = 0;

  const runs: Array<{ source: string; candidates: DiscoveryCandidate[]; error?: string; configured: boolean }> = [];
  try {
    runs.push({ source: 'hacker_news', candidates: await collectHackerNewsCandidates(fetch), configured: true });
  } catch (error) {
    runs.push({ source: 'hacker_news', candidates: [], configured: true, error: error instanceof Error ? error.message : 'unknown' });
  }

  try {
    runs.push({ source: 'github', candidates: await collectGitHubCandidates(fetch, new Date(), env.GITHUB_TOKEN ?? null), configured: true });
  } catch (error) {
    runs.push({ source: 'github', candidates: [], configured: true, error: error instanceof Error ? error.message : 'unknown' });
  }
  try {
    runs.push({ source: 'hugging_face', candidates: await collectHuggingFaceCandidates(fetch), configured: true });
  } catch (error) {
    runs.push({ source: 'hugging_face', candidates: [], configured: true, error: error instanceof Error ? error.message : 'unknown' });
  }

  for (const run of runs) {
    if (run.error) {
      sources.push({ source: run.source, skipped: `error: ${run.error}` });
      continue;
    }
    if (!run.configured) {
      sources.push({ source: run.source, skipped: 'producthunt_not_configured' });
      continue;
    }
    const ranked = [...run.candidates].sort((a, b) => heatOf(b) - heatOf(a)).slice(0, MAX_CANDIDATES_PER_RUN);
    const inserted = await upsertCandidates(env, ranked);
    sources.push({ source: run.source, inserted });
    totalInserted += inserted;
  }
  return { sources, totalInserted };
}

export function buildProductFromDiscovery(
  row: DiscoveryRow,
  options: ApproveOverrides & { categoryMap?: Map<string, { id: string; slug: string }> } = {},
): CatalogProduct {
  const name = (options.name ?? row.name).trim() || row.name;
  const websiteUrl = (options.websiteUrl ?? row.url ?? '').trim();
  const slug = slugifyName(name);
  const categoryName = (options.categoryName ?? 'AI 工具').trim() || 'AI 工具';
  const categoryMap = options.categoryMap;
  const known = categoryMap?.get(categoryName);
  const categorySlug = known?.slug ?? slugifyName(categoryName);
  const tags = (options.tags ?? JSON.parse(row.keywords_json || '[]') as string[]).slice(0, 4);
  return {
    id: slug,
    name,
    description: (options.description ?? row.description ?? row.tagline ?? name).trim(),
    price: 0,
    originalPrice: null,
    sku: `AI-${slug.replace(/-/g, '').toUpperCase().slice(0, 24) || 'TOOL'}`,
    category: {
      id: known?.id ?? `cat-${categorySlug}`,
      name: categoryName,
      slug: categorySlug,
      description: '',
      image: '',
      parentId: '',
      level: 1,
      isActive: true,
      productCount: 0,
    },
    tags,
    images: [],
    variants: [],
    inventory: {
      quantity: 999,
      reserved: 0,
      available: 999,
      lowStockThreshold: 0,
      isInStock: true,
      isLowStock: false,
      trackInventory: false,
    },
    specifications: [],
    isActive: true,
    isFeatured: options.featured ?? false,
    rating: Math.min(Math.max(options.rating ?? 0, 0), 5),
    reviewCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    typeData: websiteUrl ? { websiteUrl } : {},
  };
}

function json(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': DISCOVERY_RUNTIME } });
}

function unauthorized(): Response {
  return Response.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } },
    { status: 401 },
  );
}

function badRequest(message: string, code = 'BAD_REQUEST'): Response {
  return Response.json({ success: false, error: { code, message } }, { status: 400 });
}

async function loadRow(env: ToolDiscoveryEnv, id: string): Promise<DiscoveryRow | null> {
  return env.DB.prepare('SELECT * FROM tool_discoveries WHERE id = ?1').bind(id).first<DiscoveryRow>();
}

export interface ApproveOverrides {
  name?: string;
  description?: string;
  websiteUrl?: string;
  categoryName?: string;
  tags?: string[];
  rating?: number;
  featured?: boolean;
}

export async function approveDiscovery(
  env: ToolDiscoveryEnv,
  row: DiscoveryRow,
  overrides: ApproveOverrides = {},
): Promise<{ productId: string; catalogTotal: number }> {
  const items = await readCatalogItems(env);
  const categoryMap = new Map<string, { id: string; slug: string }>();
  for (const item of items) {
    if (item.category?.name && !categoryMap.has(item.category.name)) {
      categoryMap.set(item.category.name, { id: item.category.id, slug: item.category.slug });
    }
  }
  const product = buildProductFromDiscovery(row, { ...overrides, categoryMap });
  const baseSlug = product.id;
  const takenIds = new Set(items.map((item) => item.id));
  let suffix = 2;
  while (takenIds.has(product.id)) {
    product.id = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  product.sku = `AI-${product.id.replace(/-/g, '').toUpperCase().slice(0, 24)}`;
  const catalogTotal = await appendProductToCatalog(env, product);
  await env.DB.prepare(
    `UPDATE tool_discoveries SET status = 'approved', product_id = ?2, reviewed_at = ?3, updated_at = ?3 WHERE id = ?1`,
  ).bind(row.id, product.id, nowIso()).run();
  // Retire sibling pending rows pointing at the same tool site.
  if (product.typeData?.websiteUrl) {
    const key = dedupeKey(product.typeData.websiteUrl);
    if (key) {
      const siblings = await env.DB.prepare(
        "SELECT id, url FROM tool_discoveries WHERE status = 'pending' AND id != ?1",
      ).all<{ id: string; url: string | null }>();
      for (const sibling of siblings.results ?? []) {
        if (dedupeKey(sibling.url) !== key) continue;
        await env.DB.prepare(
          `UPDATE tool_discoveries SET status = 'duplicate', review_note = ?2, updated_at = ?3 WHERE id = ?1`,
        ).bind(sibling.id, `approved as ${product.id}`, nowIso()).run();
      }
    }
  }
  return { productId: product.id, catalogTotal };
}

export async function tryNativeToolDiscovery(request: Request, env: ToolDiscoveryEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/v1/admin/tool-discoveries/run' && request.method === 'POST') {
    if (!await authenticateNativeAdmin(request, env)) return unauthorized();
    try {
      return json(await runNativeToolDiscovery(env));
    } catch (error) {
      return Response.json(
        { success: false, error: { code: 'DISCOVERY_RUN_FAILED', message: error instanceof Error ? error.message : 'discovery run failed' } },
        { status: 502, headers: { 'x-jiffoo-runtime': DISCOVERY_RUNTIME } },
      );
    }
  }

  const listMatch = path.match(/^\/api\/v1\/admin\/tool-discoveries\/?$/);
  if (listMatch && request.method === 'GET') {
    if (!await authenticateNativeAdmin(request, env)) return unauthorized();
    const status = url.searchParams.get('status');
    const source = url.searchParams.get('source');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const where: string[] = [];
    const binds: string[] = [];
    if (status) { where.push('status = ?'); binds.push(status); }
    if (source) { where.push('source = ?'); binds.push(source); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM tool_discoveries ${whereSql}`)
      .bind(...binds).first<{ total: number }>();
    const total = totalRow?.total ?? 0;
    const rows = await env.DB.prepare(
      `SELECT * FROM tool_discoveries ${whereSql} ORDER BY discovered_at DESC LIMIT ? OFFSET ?`,
    ).bind(...binds, limit, (page - 1) * limit).all<DiscoveryRow>();
    return json({
      items: rows.results ?? [],
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  const approveMatch = path.match(/^\/api\/v1\/admin\/tool-discoveries\/([^/]+)\/approve$/);
  if (approveMatch && request.method === 'POST') {
    if (!await authenticateNativeAdmin(request, env)) return unauthorized();
    const row = await loadRow(env, decodeURIComponent(approveMatch[1]));
    if (!row) return badRequest('Discovery row not found', 'NOT_FOUND');
    if (row.status !== 'pending') return badRequest(`Discovery row is ${row.status}, not pending`, 'NOT_PENDING');
    let overrides: ApproveOverrides = {};
    try {
      const body = await request.text();
      if (body) overrides = JSON.parse(body) as ApproveOverrides;
    } catch {
      return badRequest('Request body must be JSON');
    }
    const result = await approveDiscovery(env, row, overrides);
    return json(result);
  }

  const rejectMatch = path.match(/^\/api\/v1\/admin\/tool-discoveries\/([^/]+)\/reject$/);
  if (rejectMatch && request.method === 'POST') {
    if (!await authenticateNativeAdmin(request, env)) return unauthorized();
    const row = await loadRow(env, decodeURIComponent(rejectMatch[1]));
    if (!row) return badRequest('Discovery row not found', 'NOT_FOUND');
    if (row.status !== 'pending') return badRequest(`Discovery row is ${row.status}, not pending`, 'NOT_PENDING');
    let note = '';
    try {
      const body = await request.text();
      if (body) note = (JSON.parse(body) as { note?: string }).note ?? '';
    } catch {
      return badRequest('Request body must be JSON');
    }
    await env.DB.prepare(
      `UPDATE tool_discoveries SET status = 'rejected', review_note = ?2, reviewed_at = ?3, updated_at = ?3 WHERE id = ?1`,
    ).bind(row.id, note.slice(0, 500), nowIso()).run();
    return json({ id: row.id, status: 'rejected' });
  }

  return null;
}

export interface TrendingEntry {
  name: string;
  tagline: string | null;
  heat: number;
  url: string | null;
  productId: string | null;
}

/**
 * Public read for the storefront landing: the most recent admin-approved
 * discoveries ranked by their source heat. Pending rows are intentionally
 * excluded — nothing reaches the public landing before review.
 */
export async function tryNativeToolDirectoryTrending(
  request: Request,
  env: ToolDiscoveryEnv,
): Promise<Response | null> {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/tool-directory/trending') return null;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 5, 1), 20);
  let rows: Array<{
    name: string;
    tagline: string | null;
    url: string | null;
    metrics_json: string;
    product_id: string | null;
  }>;
  try {
    rows = (await env.DB.prepare(
      `SELECT name, tagline, url, metrics_json, product_id FROM tool_discoveries
       WHERE status = 'approved' AND discovered_at >= ?1
       ORDER BY discovered_at DESC LIMIT 100`,
    ).bind(new Date(Date.now() - 30 * 86400_000).toISOString()).all<{
      name: string;
      tagline: string | null;
      url: string | null;
      metrics_json: string;
      product_id: string | null;
    }>()).results ?? [];
  } catch {
    // Instances without the tool_discoveries table (migration 0063) simply
    // keep their theme's static trending config.
    return null;
  }
  const heatOf = (metricsJson: string): number => {
    try {
      const metrics = JSON.parse(metricsJson || '{}') as Record<string, number>;
      return Number(metrics.votes ?? metrics.points ?? 0);
    } catch {
      return 0;
    }
  };
  const items = rows
    .map((row) => ({
      name: row.name,
      tagline: row.tagline,
      heat: heatOf(row.metrics_json),
      url: row.url,
      productId: row.product_id,
    }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, limit);
  return Response.json({ success: true, data: { items } }, {
    headers: {
      'cache-control': 'public, max-age=300, stale-while-revalidate=600',
      'x-jiffoo-runtime': DISCOVERY_RUNTIME,
    },
  });
}

export async function processScheduledToolDiscovery(
  env: ToolDiscoveryEnv,
): Promise<{ skipped?: string; inserted?: number }> {
  if (env.TOOL_DISCOVERY_ENABLED !== '1') return { skipped: 'tool_discovery_disabled' };
  try {
    const result = await runNativeToolDiscovery(env);
    return { inserted: result.totalInserted };
  } catch (error) {
    return { skipped: `error: ${error instanceof Error ? error.message : 'unknown'}` };
  }
}

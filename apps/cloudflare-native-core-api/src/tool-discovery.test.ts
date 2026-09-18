import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const {
  approveDiscovery,
  appendProductToCatalog,
  buildProductFromDiscovery,
  cleanShowHnTitle,
  collectHackerNewsCandidates,
  collectProductHuntCandidates,
  extractDomain,
  matchesAiKeywords,
  readCatalogItems,
  runNativeToolDiscovery,
  slugifyName,
  tryNativeToolDiscovery,
} = await import('./tool-discovery');

const CATALOG_PAYLOAD = JSON.stringify({
  success: true,
  data: {
    items: [{
      id: 'sora',
      name: 'Sora',
      description: 'AI video',
      price: 0,
      originalPrice: null,
      sku: 'AI-SORA',
      category: { id: 'cat-video', name: '视频制作', slug: 'video', description: '', image: '', parentId: '', level: 1, isActive: true, productCount: 0 },
      tags: ['video'],
      images: [],
      variants: [],
      inventory: {},
      specifications: [],
      isActive: true,
      isFeatured: true,
      rating: 4.8,
      reviewCount: 380,
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      typeData: { websiteUrl: 'https://sora.com' },
    }],
  },
});

function makeEnv(options: {
  snapshot?: { payload: string; status_code: number };
  liveDiscoveryDomains?: string[];
  rows?: Record<string, unknown>;
} = {}) {
  const batch = vi.fn(async (statements: unknown[]) => statements.map(() => ({ meta: {} })));
  const updates: Array<{ sql: string; binds: unknown[] }> = [];
  const env = {
    DB: {
      prepare: (sql: string) => {
        const makeStatement = (binds: unknown[]) => ({
          binds,
          first: async () => {
            if (sql.includes('core_api_snapshots')) {
              return options.snapshot ?? null;
            }
            if (sql.includes('COUNT(*)')) return { total: 0 };
            if (sql.includes('SELECT * FROM tool_discoveries')) {
              const id = binds[0] as string;
              return options.rows?.[id] ?? null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes('domain FROM tool_discoveries')) {
              return { results: (options.liveDiscoveryDomains ?? []).map((domain) => ({ domain })) };
            }
            return { results: [] };
          },
          run: async () => {
            updates.push({ sql, binds });
            return { meta: { changes: 1 } };
          },
        });
        const unbound = makeStatement([]);
        return { ...unbound, bind: (...binds: unknown[]) => makeStatement(binds) };
      },
      batch,
    },
  } as never as Parameters<typeof runNativeToolDiscovery>[0];
  return { env, batch, updates };
}

const catalogSnapshot = { payload: CATALOG_PAYLOAD, status_code: 200 };

const discoveryRow = {
  id: 'row-1', source: 'hacker_news', source_id: '1',
  name: 'Tracecat', tagline: 'Show HN', description: 'Open-source AI automations',
  url: 'https://tracecat.com', domain: 'tracecat.com',
  metrics_json: '{"points": 88}', keywords_json: '["show hn"]',
  status: 'pending', product_id: null, review_note: null, reviewed_at: null,
  discovered_at: '2026-09-17T00:00:00.000Z', created_at: '2026-09-17T00:00:00.000Z', updated_at: '2026-09-17T00:00:00.000Z',
} as unknown as Parameters<typeof approveDiscovery>[1];

describe('tool discovery connectors', () => {
  it('filters AI keywords and normalizes titles', () => {
    expect(matchesAiKeywords('Show HN: I built an open-source LLM playground')).toBe(true);
    expect(matchesAiKeywords('Show HN: My recipe manager in Rust')).toBe(false);
    expect(cleanShowHnTitle('Show HN: Glean – AI search')).toBe('Glean – AI search');
    expect(extractDomain('https://www.example.com/tool')).toBe('example.com');
    expect(extractDomain('not a url')).toBeNull();
    expect(slugifyName('Claude Code! (CLI)')).toBe('claude-code-cli');
  });

  it('collects only AI-related Show HN stories above the score floor', async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      hits: [
        { objectID: '1', title: 'Show HN: Tracecat – open-source AI automations', url: 'https://tracecat.com', points: 120, num_comments: 40, created_at_i: 1758000000 },
        { objectID: '2', title: 'Show HN: I wrote a TODO app in Assembly', url: 'https://todo.example', points: 300, num_comments: 10, created_at_i: 1758000000 },
        { objectID: '3', title: 'Show HN: Llama Coder – local copilot', url: null, points: 15, num_comments: 2, created_at_i: 1758000000 },
      ],
    }));
    const candidates = await collectHackerNewsCandidates(fetchImpl as unknown as typeof fetch);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ source: 'hacker_news', sourceId: '1', url: 'https://tracecat.com' });
    expect(candidates[1].url).toContain('news.ycombinator.com/item?id=3');
    expect(candidates[1].metrics).toMatchObject({ points: 15 });
  });

  it('collects AI posts from Product Hunt payloads', async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      data: { posts: { edges: [
        { node: { id: 'ph1', name: 'Gamma App 2.0', tagline: 'AI presentations', website: 'https://gamma.app', votesCount: 900, commentsCount: 40, createdAt: '2026-09-17T00:00:00Z' } },
        { node: { id: 'ph2', name: 'Yoga Timer', tagline: 'Breathe better', website: 'https://yoga.app', votesCount: 500, commentsCount: 4, createdAt: '2026-09-17T00:00:00Z' } },
      ] } },
    }));
    const candidates = await collectProductHuntCandidates(fetchImpl as unknown as typeof fetch, 'token');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ source: 'product_hunt', sourceId: 'ph1', url: 'https://gamma.app' });
  });
});

describe('tool discovery run and catalog append', () => {
  beforeEach(() => {
    authenticateNativeAdmin.mockReset();
  });

  it('reports product hunt as skipped without a token and upserts HN candidates', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('hn.algolia.com')) {
        return Response.json({ hits: [
          { objectID: '9', title: 'Show HN: AI agent framework', url: 'https://agent.example', points: 88, num_comments: 12, created_at_i: 1758000000 },
        ] });
      }
      throw new Error('unexpected fetch');
    });
    vi.stubGlobal('fetch', fetchImpl);
    try {
      const { env } = makeEnv({ snapshot: catalogSnapshot });
      const result = await runNativeToolDiscovery(env);
      expect(result.sources).toEqual([
        { source: 'hacker_news', inserted: 1 },
        { source: 'product_hunt', skipped: 'producthunt_not_configured' },
      ]);
      expect(result.totalInserted).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('appends approved products to the catalog list and detail snapshots', async () => {
    const { env, batch } = makeEnv({ snapshot: catalogSnapshot });
    const items = await readCatalogItems(env);
    expect(items).toHaveLength(1);
    const product = buildProductFromDiscovery(discoveryRow, { categoryName: '工作流' });
    expect(product).toMatchObject({
      id: 'tracecat',
      sku: 'AI-TRACECAT',
      typeData: { websiteUrl: 'https://tracecat.com' },
    });
    expect(product.category.name).toBe('工作流');
    await appendProductToCatalog(env, product);
    expect(batch).toHaveBeenCalledTimes(1);
    const [listStatement, detailStatement] = batch.mock.calls[0][0] as Array<{ binds: unknown[] }>;
    const listBody = JSON.parse(listStatement.binds[2] as string) as { data: { items: Array<{ id: string }>; total: number } };
    expect(listBody.data.total).toBe(2);
    expect(listBody.data.items.map((item) => item.id)).toEqual(['sora', 'tracecat']);
    expect(detailStatement.binds[1]).toBe('/api/v1/products/tracecat');
  });

  it('approves a pending row, publishes it, and retires same-domain siblings', async () => {
    const { env, updates } = makeEnv({
      snapshot: catalogSnapshot,
      rows: { 'row-1': discoveryRow },
    });
    const result = await approveDiscovery(env, discoveryRow, { categoryName: '工作流' });
    expect(result).toMatchObject({ productId: 'tracecat', catalogTotal: 2 });
    const statusUpdate = updates.find((update) => update.sql.includes("status = 'approved'"));
    expect(statusUpdate?.binds[1]).toBe('tracecat');
    const siblingUpdate = updates.find((update) => update.sql.includes("status = 'duplicate'"));
    expect(siblingUpdate).toBeDefined();
  });

  it('serves the authenticated admin review endpoints', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const { env } = makeEnv({
      snapshot: catalogSnapshot,
      rows: { 'row-1': discoveryRow },
    });
    const list = await tryNativeToolDiscovery(
      new Request('https://native.invalid/api/v1/admin/tool-discoveries?status=pending'),
      env,
    );
    expect(list?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-tool-discovery');
    expect(await list?.json()).toMatchObject({ success: true, data: { page: 1, limit: 20 } });

    const reject = await tryNativeToolDiscovery(
      new Request('https://native.invalid/api/v1/admin/tool-discoveries/row-1/reject', {
        method: 'POST',
        body: JSON.stringify({ note: 'off topic' }),
      }),
      env,
    );
    expect(await reject?.json()).toMatchObject({ success: true, data: { id: 'row-1', status: 'rejected' } });
  });

  it('rejects discovery mutations for unauthenticated administrators', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const { env } = makeEnv({ snapshot: catalogSnapshot });
    const listResponse = await tryNativeToolDiscovery(
      new Request('https://native.invalid/api/v1/admin/tool-discoveries?status=pending'),
      env,
    );
    expect(listResponse?.status).toBe(401);
    const runResponse = await tryNativeToolDiscovery(
      new Request('https://native.invalid/api/v1/admin/tool-discoveries/run', { method: 'POST' }),
      env,
    );
    expect(runResponse?.status).toBe(401);
  });
});

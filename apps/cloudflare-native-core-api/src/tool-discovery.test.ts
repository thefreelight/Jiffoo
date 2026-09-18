import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

const {
  approveDiscovery,
  appendProductToCatalog,
  buildProductFromDiscovery,
  cleanShowHnTitle,
  collectHackerNewsCandidates,
  collectGitHubCandidates,
  collectHuggingFaceCandidates,
  dedupeKey,
  extractDomain,
  looksLikeNewsDomain,
  looksLikeNewsTitle,
  matchesAiKeywords,
  readCatalogItems,
  runNativeToolDiscovery,
  slugifyName,
  tryNativeToolDirectoryTrending,
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
  liveDiscoveryUrls?: string[];
  rows?: Record<string, unknown>;
  pendingSiblings?: Array<{ id: string; url: string | null }>;
  trendingRows?: Array<{ name: string; tagline: string | null; url: string | null; metrics_json: string; product_id: string | null }>;
  missingDiscoveryTable?: boolean;
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
            if (sql.includes("status = 'pending' AND id !=")) {
              return { results: options.pendingSiblings ?? [] };
            }
            if (sql.includes('url FROM tool_discoveries')) {
              return { results: (options.liveDiscoveryUrls ?? []).map((url) => ({ url })) };
            }
            if (sql.includes("status = 'approved'")) {
              if (options.missingDiscoveryTable) {
                throw new Error('no such table: tool_discoveries');
              }
              return { results: options.trendingRows ?? [] };
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
        // Text-only stories fall back to the HN discussion domain, which is
        // blocklisted: directory listings need an official tool site.
        { objectID: '3', title: 'Show HN: Llama Coder – local copilot', url: null, points: 15, num_comments: 2, created_at_i: 1758000000 },
      ],
    }));
    const candidates = await collectHackerNewsCandidates(fetchImpl as unknown as typeof fetch);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ source: 'hacker_news', sourceId: '1', url: 'https://tracecat.com' });
    expect(candidates[0].metrics).toMatchObject({ points: 120 });
  });

  it('runs all three connectors and upserts HN candidates', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('hn.algolia.com')) {
        return Response.json({ hits: [
          { objectID: '9', title: 'Show HN: AI agent framework', url: 'https://agent.example', points: 88, num_comments: 12, created_at_i: 1758000000 },
        ] });
      }
      if (url.includes('api.github.com')) {
        return Response.json({ items: [
          { full_name: 'acme/agent-kit', name: 'agent-kit', html_url: 'https://github.com/acme/agent-kit', description: 'Toolkit for building AI agents', stargazers_count: 210, created_at: '2026-09-15T00:00:00Z' },
        ] });
      }
      if (url.includes('huggingface.co')) {
        return Response.json([
          { id: 'acme/ai-playground', likes: 320, trendingScore: 50 },
        ]);
      }
      throw new Error('unexpected fetch');
    });
    vi.stubGlobal('fetch', fetchImpl);
    try {
      const { env } = makeEnv({ snapshot: catalogSnapshot });
      const result = await runNativeToolDiscovery(env);
      expect(result.sources).toEqual([
        { source: 'hacker_news', inserted: 1 },
        { source: 'github', inserted: 1 },
        { source: 'hugging_face', inserted: 1 },
      ]);
      expect(result.totalInserted).toBe(3);
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
      pendingSiblings: [{ id: 'row-2', url: 'https://tracecat.com/landing' }],
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

describe('connector quality filters', () => {
  it('rejects news domains, security headlines and essay titles', async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      hits: [
        { objectID: 'n1', title: "Microsoft, OpenAI lose fight to hide internal docs admitting scraping", url: 'https://arstechnica.com/ai/1', points: 44, num_comments: 10, created_at_i: 1758000000 },
        { objectID: 'n2', title: 'A heap overflow and SSO misconfiguration to compromise OpenAI', url: 'https://hacktron.ai/post/1', points: 343, num_comments: 90, created_at_i: 1758000000 },
        { objectID: 'n3', title: 'How to Write with an LLM', url: 'https://sockpuppet.org/blog', points: 153, num_comments: 70, created_at_i: 1758000000 },
        { objectID: 'n4', title: 'Sex, AI, and the Apocalypse', url: 'https://iankduncan.com/essay', points: 207, num_comments: 100, created_at_i: 1758000000 },
        { objectID: 't1', title: 'MCPJam – testing platform for MCP servers', url: 'https://mcpjam.com', points: 61, num_comments: 12, created_at_i: 1758000000 },
      ],
    }));
    const candidates = await collectHackerNewsCandidates(fetchImpl as unknown as typeof fetch);
    expect(candidates.map((candidate) => candidate.sourceId)).toEqual(['t1']);
    expect(looksLikeNewsDomain('www.wsj.com')).toBe(true);
    expect(looksLikeNewsDomain('mcpjam.com')).toBe(false);
    expect(looksLikeNewsTitle('A heap overflow and SSO misconfiguration')).toBe(true);
    expect(looksLikeNewsTitle('Glean – AI search')).toBe(false);
  });
});

describe('public trending endpoint', () => {
  it('serves approved discoveries ranked by heat', async () => {
    const { env } = makeEnv({
      trendingRows: [
        { name: 'MCPJam', tagline: 'MCP testing', url: 'https://mcpjam.com', metrics_json: '{"points": 61}', product_id: null },
        { name: 'Tracecat', tagline: 'Show HN', url: 'https://tracecat.com', metrics_json: '{"points": 88}', product_id: 'tracecat' },
      ],
    });
    const response = await tryNativeToolDirectoryTrending(
      new Request('https://native.invalid/api/v1/tool-directory/trending?limit=5'),
      env,
    );
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-tool-discovery');
    const body = await response?.json() as { data: { items: Array<{ name: string; heat: number }> } };
    expect(body.data.items.map((item) => item.name)).toEqual(['Tracecat', 'MCPJam']);
    expect(body.data.items[0]).toMatchObject({ heat: 88, productId: 'tracecat' });
  });

  it('falls through on instances without the discovery table', async () => {
    const { env } = makeEnv({ missingDiscoveryTable: true });
    const response = await tryNativeToolDirectoryTrending(
      new Request('https://native.invalid/api/v1/tool-directory/trending'),
      env,
    );
    expect(response).toBeNull();
  });
});

describe('github and hugging face connectors', () => {
  it('collects fresh AI-topic repos from GitHub, news titles excluded', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('topic%3Achatbot')) {
        return Response.json({ items: [
          { full_name: 'acme/notice-bot', name: 'notice-bot', html_url: 'https://github.com/acme/notice-bot', description: 'AI chatbot for news digests', stargazers_count: 90, created_at: '2026-09-15T00:00:00Z' },
        ] });
      }
      if (String(input).includes('topic%3Aai')) {
        return Response.json({ items: [
          { full_name: 'acme/agent-kit', name: 'agent-kit', html_url: 'https://github.com/acme/agent-kit', description: 'Toolkit for building AI agents', stargazers_count: 210, created_at: '2026-09-15T00:00:00Z' },
          { full_name: 'acme/ai-news-digest', name: 'ai-news-digest', html_url: 'https://github.com/acme/ai-news-digest', description: 'We summarise AI lawsuits daily', stargazers_count: 500, created_at: '2026-09-15T00:00:00Z' },
        ] });
      }
      return Response.json({ items: [] });
    });
    const candidates = await collectGitHubCandidates(fetchImpl as unknown as typeof fetch);
    expect(candidates.map((candidate) => candidate.sourceId)).toEqual(['acme/agent-kit', 'acme/notice-bot']);
    expect(candidates[0]).toMatchObject({ source: 'github', url: 'https://github.com/acme/agent-kit', metrics: { stars: 210 } });
  });

  it('collects trending Hugging Face Spaces', async () => {
    const fetchImpl = vi.fn(async () => Response.json([
      { id: 'acme/ai-playground', likes: 320, trendingScore: 50 },
      { id: 'invalid', likes: 999 },
    ]));
    const candidates = await collectHuggingFaceCandidates(fetchImpl as unknown as typeof fetch);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: 'hugging_face',
      sourceId: 'acme/ai-playground',
      url: 'https://huggingface.co/spaces/acme/ai-playground',
      metrics: { likes: 320 },
    });
  });

  it('keeps distinct tools on shared hosts and dedupes by domain otherwise', () => {
    expect(dedupeKey('https://github.com/acme/agent-kit')).toBe('https://github.com/acme/agent-kit');
    expect(dedupeKey('https://github.com/acme/other-tool/')).toBe('https://github.com/acme/other-tool');
    expect(dedupeKey('https://www.tracecat.com/x')).toBe('tracecat.com');
  });
});

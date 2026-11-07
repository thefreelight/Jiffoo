import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeAdmin }));
const isNativePluginEnabled = vi.fn();
vi.mock('./plugin-enabled', () => ({ isNativePluginEnabled }));

const { tryNativeSupportHub, mergeNativeSettings, nativePublicConfig, validateSupportHubSettings, buildNativeAiRequestUrl, buildNativeAiPayload, buildNativeHandoffReply, parseNativeAiReply } = await import('./support-hub');
const { tryNativeMarketplace } = await import('./marketplace');

afterEach(() => vi.unstubAllGlobals());

// Stateful D1 fake over the shared native_plugin_instances row so settings
// persistence round-trips the same way as on a real Worker.
function fakeDb() {
  const state = { enabled: 1, config_json: '{}' as string };
  const firstFor = (sql: string) => async () => {
    if (sql.includes('SELECT enabled')) return { enabled: state.enabled };
    if (sql.includes('SELECT config_json')) return { config_json: state.config_json };
    return null;
  };
  return {
    state,
    prepare: (sql: string) => ({
      first: firstFor(sql),
      bind: (...args: unknown[]) => ({
        first: firstFor(sql),
        run: async () => {
          if (sql.includes('INSERT INTO native_plugin_instances')) {
            state.config_json = String(args[1]);
          }
          return {} as never;
        },
      }),
    }),
  };
}

const storeRequest = (path: string, init?: RequestInit) =>
  new Request(`https://api.example/api/v1/plugins/support-hub/store${path}`, init);
const mountAdminRequest = (path: string, init?: RequestInit) =>
  new Request(`https://api.example/api/v1/plugins/support-hub/admin${path}`, init);
const gatewayRequest = (path: string, init?: RequestInit) =>
  new Request(`https://api.example/api/v1/extensions/plugin/support-hub/api${path}`, init);

describe('native support hub adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
  });

  it('ignores unrelated paths', async () => {
    const db = fakeDb();
    const response = await tryNativeSupportHub(new Request('https://api.example/api/v1/plugins/wallet/store/balance'), { DB: db } as never);
    expect(response).toBeNull();
    const unknownNamespaceRoute = await tryNativeSupportHub(gatewayRequest('/webhooks/anything'), { DB: db } as never);
    expect(unknownNamespaceRoute?.status).toBe(404);
    await expect(unknownNamespaceRoute?.json()).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('404s when the plugin is not enabled', async () => {
    isNativePluginEnabled.mockResolvedValue(false);
    const response = await tryNativeSupportHub(storeRequest('/health'), { DB: fakeDb() } as never);
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'PLUGIN_NOT_ENABLED' } });
  });

  it('serves store health and defaults through the storefront mount', async () => {
    const db = fakeDb();
    const health = await tryNativeSupportHub(storeRequest('/health'), { DB: db } as never);
    expect(health?.status).toBe(200);
    await expect(health?.json()).resolves.toMatchObject({ status: 'healthy', plugin: 'support-hub', version: '0.0.4' });

    const config = await tryNativeSupportHub(storeRequest('/config'), { DB: db } as never);
    await expect(config?.json()).resolves.toMatchObject({ success: true, data: { enabled: true, channels: [] } });
    expect(config?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-support-hub');
  });

  it('serves the same contract through the gateway alias', async () => {
    const db = fakeDb();
    const health = await tryNativeSupportHub(gatewayRequest('/store/health'), { DB: db } as never);
    await expect(health?.json()).resolves.toMatchObject({ status: 'healthy', version: '0.0.4' });
    const config = await tryNativeSupportHub(gatewayRequest('/store/config'), { DB: db } as never);
    await expect(config?.json()).resolves.toMatchObject({ success: true, data: { enabled: true, channels: [] } });
  });

  it('serves admin settings through the bare plugin mount shape (0.0.3 client fetch path)', async () => {
    const db = fakeDb();
    const saved = await tryNativeSupportHub(mountAdminRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify({ whatsappEnabled: true, whatsappLink: 'https://wa.me/15551234567' }),
    }), { DB: db } as never);
    expect(saved?.status).toBe(200);
    const fetched = await tryNativeSupportHub(mountAdminRequest('/settings'), { DB: db } as never);
    await expect(fetched?.json()).resolves.toMatchObject({ data: { whatsappEnabled: true } });
    const config = await tryNativeSupportHub(storeRequest('/config'), { DB: db } as never);
    const configBody = await config?.json();
    expect(configBody.data.channels).toEqual([
      { kind: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/15551234567' },
    ]);
  });

  it('persists settings via admin PUT and reflects them in store config', async () => {
    const db = fakeDb();
    const saved = await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ telegramEnabled: true, telegramLink: 'https://t.me/jiffoo_support', whatsappEnabled: false }),
    }), { DB: db } as never);
    expect(saved?.status).toBe(200);
    const savedBody = await saved?.json();
    expect(savedBody.data.retentionDays).toBe(90);
    expect(db.state.config_json).toContain('https://t.me/jiffoo_support');

    const fetched = await tryNativeSupportHub(gatewayRequest('/admin/settings'), { DB: db } as never);
    await expect(fetched?.json()).resolves.toMatchObject({ data: { telegramEnabled: true } });

    const config = await tryNativeSupportHub(storeRequest('/config'), { DB: db } as never);
    const configBody = await config?.json();
    expect(configBody.data.channels).toEqual([
      { kind: 'telegram', label: 'Telegram', href: 'https://t.me/jiffoo_support' },
    ]);
  });

  it('rejects enabling a channel without a link', async () => {
    const response = await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ whatsappEnabled: true, whatsappLink: '' }),
    }), { DB: fakeDb() } as never);
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'SUPPORT_HUB_SETTINGS_INVALID' } });
  });

  it('requires admin authentication for /admin routes', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const response = await tryNativeSupportHub(gatewayRequest('/admin/settings'), { DB: fakeDb() } as never);
    expect(response?.status).toBe(401);
  });

  it('exposes pure helpers used by the generic admin panel path', () => {
    expect(mergeNativeSettings({}).defaultQueue).toBe('general');
    expect(validateSupportHubSettings({ telegramEnabled: true, telegramLink: 't.me/x' })).toMatch(/http\(s\)/);
    expect(validateSupportHubSettings({ telegramEnabled: true, telegramLink: 'https://t.me/x', retentionDays: 4000 })).toMatch(/retentionDays/);
    expect(validateSupportHubSettings({})).toBeNull();
    expect(nativePublicConfig(mergeNativeSettings({ enabled: false, feishuEnabled: true, feishuLink: 'https://x.com' })).channels).toEqual([]);
  });
});

describe('native marketplace install of support-hub', () => {
  it('allows support-hub to install natively now that the adapter exists', async () => {
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { items: [
      { slug: 'support-hub', kind: 'plugin', installable: true, sellableVersion: '0.0.4' },
    ] } })));
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
    const response = await tryNativeMarketplace(new Request('https://api.example/api/v1/admin/market/extensions/support-hub/install', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'plugin' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ success: true, data: { slug: 'support-hub', version: '0.0.4' } });
    expect(run).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 0.0.4 chat: stateful D1 fake over native_support_hub_* tables + AI stubs
// ---------------------------------------------------------------------------

type FakeRow = Record<string, unknown>;

function chatFakeDb() {
  const state = { config_json: '{}' };
  const conversations = new Map<string, {
    id: string; installation_id: string; visitor_token: string; status: string;
    message_count: number; created_at: string; updated_at: string;
  }>();
  const messages: Array<{
    id: string; conversation_id: string; installation_id: string; role: string;
    content: string; actions_json: string | null; created_at: string;
  }> = [];

  const exec = (sql: string, args: unknown[]) => {
    if (sql.includes('SELECT config_json FROM native_plugin_instances')) {
      return { first: async () => ({ config_json: state.config_json }) };
    }
    if (sql.includes('INSERT INTO native_plugin_instances')) {
      return { run: async () => { state.config_json = String(args[1]); return {} as never; }, first: async () => null, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('INSERT INTO native_support_hub_conversations')) {
      return { run: async () => {
        conversations.set(String(args[0]), {
          id: String(args[0]), installation_id: String(args[1]), visitor_token: String(args[2]),
          status: 'open', message_count: 0, created_at: String(args[3]), updated_at: String(args[3]),
        });
        return {} as never;
      }, first: async () => null, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('UPDATE native_support_hub_conversations')) {
      return { run: async () => {
        const conversation = conversations.get(String(args[0]));
        if (conversation) { conversation.message_count += 1; conversation.updated_at = String(args[1]); }
        return {} as never;
      }, first: async () => null, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('INSERT INTO native_support_hub_messages')) {
      return { run: async () => {
        messages.push({
          id: String(args[0]), conversation_id: String(args[1]), installation_id: String(args[2]),
          role: String(args[3]), content: String(args[4]),
          actions_json: args[5] === null ? null : String(args[5]), created_at: String(args[6]),
        });
        return {} as never;
      }, first: async () => null, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('SELECT COUNT(*) AS count')) {
      return { first: async () => ({
        count: messages.filter((message) => {
          const conversation = conversations.get(message.conversation_id);
          return message.role === 'visitor' && conversation
            && conversation.installation_id === String(args[0])
            && conversation.visitor_token === String(args[1])
            && message.created_at > String(args[2]);
        }).length,
      }), all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('FROM native_support_hub_messages') && sql.includes('ORDER BY created_at ASC')) {
      return { all: async () => ({
        results: messages
          .filter((message) => message.conversation_id === String(args[0]))
          .sort((a, b) => a.created_at.localeCompare(b.created_at)) as unknown as FakeRow[],
      }), first: async () => null };
    }
    if (sql.includes('FROM native_support_hub_messages') && sql.includes('ORDER BY created_at DESC LIMIT 1')) {
      return { first: async () => {
        const rows = messages
          .filter((message) => message.conversation_id === String(args[0]))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return rows[0] ? { content: rows[0].content } : null;
      }, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('FROM native_support_hub_conversations c')) {
      return { all: async () => ({
        results: [...conversations.values()]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((conversation) => ({
            id: conversation.id, visitorToken: conversation.visitor_token, status: conversation.status,
            messageCount: conversation.message_count, createdAt: conversation.created_at, updatedAt: conversation.updated_at,
          })) as unknown as FakeRow[],
      }), first: async () => null };
    }
    if (sql.includes('FROM native_support_hub_conversations') && sql.includes('WHERE id = ?1 AND installation_id = ?2 AND visitor_token = ?3')) {
      return { first: async () => {
        const conversation = conversations.get(String(args[0]));
        return conversation && conversation.installation_id === String(args[1]) && conversation.visitor_token === String(args[2])
          ? conversation : null;
      }, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('SELECT id, visitor_token FROM native_support_hub_conversations')) {
      return { first: async () => {
        const conversation = conversations.get(String(args[0]));
        return conversation ? { id: conversation.id, visitor_token: conversation.visitor_token } : null;
      }, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('FROM native_support_hub_conversations') && sql.includes('WHERE id = ?1 LIMIT 1')) {
      return { first: async () => conversations.get(String(args[0])) ?? null, all: async () => ({ results: [] as FakeRow[] }) };
    }
    if (sql.includes('FROM native_support_hub_conversations') && sql.includes('WHERE installation_id = ?1 AND visitor_token = ?2')) {
      return { first: async () => {
        for (const conversation of conversations.values()) {
          if (conversation.installation_id === String(args[0]) && conversation.visitor_token === String(args[1])) return conversation;
        }
        return null;
      }, all: async () => ({ results: [] as FakeRow[] }) };
    }
    throw new Error(`chatFakeDb: unhandled SQL: ${sql.slice(0, 90)}`);
  };

  return {
    state, conversations, messages,
    prepare: (sql: string) => {
      const run = (args: unknown[]) => exec(sql, args);
      return {
        bind: (...args: unknown[]) => run(args),
        first: async () => {
          const branch = run([]);
          return branch.first ? await branch.first() : null;
        },
        all: async () => {
          const branch = run([]);
          return branch.all ? await branch.all() : { results: [] as FakeRow[] };
        },
        run: async () => {
          const branch = run([]);
          return branch.run ? await branch.run() : ({} as never);
        },
      };
    },
  };
}

const AI_URL = 'https://ai.example.test/v1/chat/completions';
const WEBHOOK_URL = 'https://bot.example.test/hooks/support';

function stubFetch(options: { aiStatus?: number; aiBody?: unknown; fail?: boolean } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === WEBHOOK_URL) return Response.json({ ok: true });
    if (options.fail) throw new Error('provider unreachable');
    return Response.json(
      options.aiBody ?? { choices: [{ message: { role: 'assistant', content: 'Native AI reply' } }] },
      { status: options.aiStatus ?? 200 },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

const chatPost = (db: unknown, body: unknown, scheduleBackground?: (promise: Promise<unknown>) => void) =>
  tryNativeSupportHub(storeRequest('/chat/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  }), { DB: db } as never, scheduleBackground);

describe('native support hub 0.0.4 chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePluginEnabled.mockResolvedValue(true);
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
  });

  it('includes the chat block in store config (disabled by default)', async () => {
    const db = chatFakeDb();
    const config = await tryNativeSupportHub(storeRequest('/config'), { DB: db } as never);
    const body = await config?.json();
    expect(body.data.chat).toEqual({ enabled: false, welcomeMessage: 'Hi! How can we help you today?' });
  });

  it('404s chat endpoints when chat is disabled', async () => {
    const db = chatFakeDb();
    const sent = await chatPost(db, { visitorToken: 'visitor_12345678', message: 'hello' });
    expect(sent?.status).toBe(404);
    await expect(sent?.json()).resolves.toMatchObject({ error: { code: 'CHAT_DISABLED' } });
  });

  it('answers a visitor message via the configured AI provider and persists the transcript', async () => {
    const db = chatFakeDb();
    const configure = await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        chatEnabled: true, aiEnabled: true, aiBaseUrl: 'https://ai.example.test/v1',
        aiApiKey: 'sk-native', aiModel: 'gpt-4o-mini',
      }),
    }), { DB: db } as never);
    expect(configure?.status).toBe(200);

    const { calls } = stubFetch();
    const background: Array<Promise<unknown>> = [];
    const sent = await chatPost(db, { visitorToken: 'visitor_12345678', message: 'Where is my order?' }, (promise) => background.push(promise));
    expect(sent?.status).toBe(200);
    const body = await sent?.json();
    expect(body.data.conversationId).toMatch(/^shconv_/);
    expect(body.data.reply.role).toBe('assistant');
    expect(body.data.reply.content).toBe('Native AI reply');

    const aiCalls = calls.filter((call) => call.url === AI_URL);
    expect(aiCalls).toHaveLength(1);
    const payload = JSON.parse(String(aiCalls[0]?.init?.body));
    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[payload.messages.length - 1]).toEqual({ role: 'user', content: 'Where is my order?' });

    const history = await tryNativeSupportHub(storeRequest('/chat/history?visitorToken=visitor_12345678'), { DB: db } as never);
    const historyBody = await history?.json();
    expect(historyBody.data.conversationId).toBe(body.data.conversationId);
    expect(historyBody.data.messages.map((message: { content: string }) => message.content)).toEqual([
      'Where is my order?',
      'Native AI reply',
    ]);
  });

  it('falls back to the handoff reply with channel actions when the provider fails', async () => {
    const db = chatFakeDb();
    await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        chatEnabled: true, aiEnabled: true, aiBaseUrl: 'https://ai.example.test/v1',
        aiApiKey: 'sk-native', aiModel: 'gpt-4o-mini',
        telegramEnabled: true, telegramLink: 'https://t.me/bokmoo',
      }),
    }), { DB: db } as never);
    stubFetch({ fail: true });

    const sent = await chatPost(db, { visitorToken: 'visitor_12345678', message: 'help please' });
    expect(sent?.status).toBe(200);
    const body = await sent?.json();
    expect(body.data.reply.content).toContain('unavailable');
    expect(body.data.reply.actions).toEqual([
      { kind: 'telegram', label: 'Telegram', href: 'https://t.me/bokmoo' },
    ]);
  });

  it('rate limits a visitor after twenty messages per minute', async () => {
    const db = chatFakeDb();
    await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT', body: JSON.stringify({ chatEnabled: true }),
    }), { DB: db } as never);
    stubFetch();
    for (let index = 0; index < 20; index += 1) {
      const sent = await chatPost(db, { visitorToken: 'visitor_rate_limit_01', message: `message ${index}` });
      expect(sent?.status).toBe(200);
    }
    const overflow = await chatPost(db, { visitorToken: 'visitor_rate_limit_01', message: 'one too many' });
    expect(overflow?.status).toBe(429);
    await expect(overflow?.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('executes the bot webhook through waitUntil when enabled', async () => {
    const db = chatFakeDb();
    await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ chatEnabled: true, botWebhookEnabled: true, botWebhookUrl: WEBHOOK_URL }),
    }), { DB: db } as never);
    const { calls } = stubFetch();
    const background: Array<Promise<unknown>> = [];
    const sent = await chatPost(db, { visitorToken: 'visitor_12345678', message: 'hello bot' }, (promise) => background.push(promise));
    expect(sent?.status).toBe(200);
    expect(background).toHaveLength(1);
    await Promise.all(background);
    const webhookCalls = calls.filter((call) => call.url === WEBHOOK_URL);
    expect(webhookCalls).toHaveLength(1);
    const webhookBody = JSON.parse(String(webhookCalls[0]?.init?.body));
    expect(webhookBody.event).toBe('support_hub.chat.reply');
    expect(webhookBody.conversationId).toMatch(/^shconv_/);
  });

  it('lists conversations and their messages on the admin surfaces', async () => {
    const db = chatFakeDb();
    await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ chatEnabled: true, aiEnabled: true, aiBaseUrl: 'https://ai.example.test/v1', aiApiKey: 'sk-native', aiModel: 'gpt-4o-mini' }),
    }), { DB: db } as never);
    stubFetch();
    const sent = await chatPost(db, { visitorToken: 'visitor_12345678', message: 'inbox question' });
    const conversationId = (await sent?.json()).data.conversationId;

    const list = await tryNativeSupportHub(gatewayRequest('/admin/conversations'), { DB: db } as never);
    const listBody = await list?.json();
    expect(listBody.data.conversations).toHaveLength(1);
    expect(listBody.data.conversations[0]).toMatchObject({
      id: conversationId, visitorToken: 'visitor_12345678', messageCount: 2, lastMessage: 'Native AI reply',
    });

    const transcript = await tryNativeSupportHub(gatewayRequest(`/admin/conversations/${conversationId}/messages`), { DB: db } as never);
    const transcriptBody = await transcript?.json();
    expect(transcriptBody.data.visitorToken).toBe('visitor_12345678');
    expect(transcriptBody.data.messages.map((message: { role: string }) => message.role)).toEqual(['visitor', 'assistant']);

    const missing = await tryNativeSupportHub(gatewayRequest('/admin/conversations/shconv_unknown0000/messages'), { DB: db } as never);
    expect(missing?.status).toBe(404);
  });

  it('validates chat payloads and AI settings', async () => {
    const db = chatFakeDb();
    await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT', body: JSON.stringify({ chatEnabled: true }),
    }), { DB: db } as never);
    const badToken = await chatPost(db, { visitorToken: 'nope', message: 'hello' });
    expect(badToken?.status).toBe(400);
    const badMessage = await chatPost(db, { visitorToken: 'visitor_12345678', message: '   ' });
    expect(badMessage?.status).toBe(400);
    const badAi = await tryNativeSupportHub(gatewayRequest('/admin/settings', {
      method: 'PUT', body: JSON.stringify({ aiEnabled: true }),
    }), { DB: db } as never);
    expect(badAi?.status).toBe(400);
  });

  it('exposes 0.0.4 AI helper semantics', () => {
    expect(buildNativeAiRequestUrl('https://ai.example.test/v1')).toBe(AI_URL);
    expect(buildNativeAiRequestUrl('https://ai.example.test/v1/')).toBe(AI_URL);
    expect(buildNativeAiRequestUrl(`${AI_URL}/`)).toBe(AI_URL);
    const settings = mergeNativeSettings({ aiSystemPrompt: 'Shop prompt.' });
    const payload = buildNativeAiPayload(settings, [{ role: 'visitor', content: 'hi' }], 'help');
    expect(payload.messages[0]).toEqual({ role: 'system', content: 'Shop prompt.' });
    expect(payload.messages[payload.messages.length - 1].content).toBe('help');
    expect(parseNativeAiReply({ choices: [{ message: { content: ' reply ' } }] })).toBe('reply');
    expect(parseNativeAiReply({ choices: [] })).toBeNull();
    const handoff = buildNativeHandoffReply(mergeNativeSettings({ telegramEnabled: true, telegramLink: 'https://t.me/bokmoo' }));
    expect(handoff.actions.map((action) => action.href)).toEqual(['https://t.me/bokmoo']);
  });
});

/**
 * Native Support Hub marketplace adapter.
 *
 * Mirrors the contract-v1 `support-hub` plugin (extensions repo, 0.0.4) on the
 * Cloudflare Native D1/Worker line. Settings persist in the shared
 * `native_plugin_instances.config_json` row created by the official-market
 * install, so the generic admin instance PATCH surface (plugin-settings.ts)
 * and this plugin's `/admin/settings` contract read and write the same data.
 * Chat transcripts persist in `native_support_hub_conversations` /
 * `native_support_hub_messages` (migration 0075).
 *
 * AI replies use the merchant-configured OpenAI-compatible endpoint
 * (aiBaseUrl/aiApiKey/aiModel) and fall back to the handoff message plus
 * enabled channel actions on any failure — visitors never see a 5xx.
 *
 * Route shapes follow the established native adapters (wallet, affiliate):
 *   - storefront:  /api/v1/plugins/support-hub/store/{health,config,chat/*}
 *   - gateway:     /api/v1/extensions/plugin/support-hub/api/{store,admin}/...
 */

import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

type SupportHubEnv = NativeAuthEnv & { DB: D1Database };

const RUNTIME = 'cloudflare-native-support-hub';
const PLUGIN_VERSION = '0.0.4';

export interface SupportHubSettings {
  enabled: boolean;
  telegramEnabled: boolean;
  telegramLink: string;
  whatsappEnabled: boolean;
  whatsappLink: string;
  feishuEnabled: boolean;
  feishuLink: string;
  httpsChatEnabled: boolean;
  httpsChatUrl: string;
  retentionDays: number;
  autoAssign: boolean;
  defaultQueue: string;
  chatEnabled: boolean;
  aiEnabled: boolean;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
  aiWelcomeMessage: string;
  aiHandoffMessage: string;
  botWebhookEnabled: boolean;
  botWebhookUrl: string;
}

const DEFAULT_SETTINGS: SupportHubSettings = {
  enabled: true,
  telegramEnabled: false,
  telegramLink: '',
  whatsappEnabled: false,
  whatsappLink: '',
  feishuEnabled: false,
  feishuLink: '',
  httpsChatEnabled: false,
  httpsChatUrl: '',
  retentionDays: 90,
  autoAssign: true,
  defaultQueue: 'general',
  chatEnabled: false,
  aiEnabled: false,
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '',
  aiSystemPrompt:
    'You are a friendly e-commerce customer support assistant. Answer briefly and helpfully. If you cannot help with something, suggest reaching the human support channels.',
  aiWelcomeMessage: 'Hi! How can we help you today?',
  aiHandoffMessage:
    'Our AI assistant is unavailable right now. Please reach us through one of the channels below and we will get back to you.',
  botWebhookEnabled: false,
  botWebhookUrl: '',
};

export interface SupportChannel {
  kind: string;
  label: string;
  href: string;
}

export interface SupportChatAction extends SupportChannel {}

export interface SupportChatMessage {
  id: string;
  role: 'visitor' | 'assistant';
  content: string;
  actions?: SupportChatAction[];
  createdAt: string;
}

export interface SupportChatConfig {
  enabled: boolean;
  welcomeMessage: string;
}

const VISITOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const MESSAGE_MAX_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_VISITOR_MESSAGES = 20;
const AI_HISTORY_LIMIT = 10;
const AI_TIMEOUT_MS = 12_000;
const WEBHOOK_TIMEOUT_MS = 5_000;

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readStr(value: unknown, fallback: string, maxLength = 500): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

export function mergeNativeSettings(input: Partial<SupportHubSettings>): SupportHubSettings {
  return { ...DEFAULT_SETTINGS, ...input };
}

function normalizeSettings(raw: Record<string, unknown>): SupportHubSettings {
  return mergeNativeSettings({
    enabled: readBool(raw.enabled, DEFAULT_SETTINGS.enabled),
    telegramEnabled: readBool(raw.telegramEnabled, false),
    telegramLink: readStr(raw.telegramLink, ''),
    whatsappEnabled: readBool(raw.whatsappEnabled, false),
    whatsappLink: readStr(raw.whatsappLink, ''),
    feishuEnabled: readBool(raw.feishuEnabled, false),
    feishuLink: readStr(raw.feishuLink, ''),
    httpsChatEnabled: readBool(raw.httpsChatEnabled, false),
    httpsChatUrl: readStr(raw.httpsChatUrl, ''),
    retentionDays: typeof raw.retentionDays === 'number' && Number.isFinite(raw.retentionDays) && raw.retentionDays >= 0
      ? Math.round(raw.retentionDays)
      : DEFAULT_SETTINGS.retentionDays,
    autoAssign: readBool(raw.autoAssign, DEFAULT_SETTINGS.autoAssign),
    defaultQueue: readStr(raw.defaultQueue, DEFAULT_SETTINGS.defaultQueue),
    chatEnabled: readBool(raw.chatEnabled, DEFAULT_SETTINGS.chatEnabled),
    aiEnabled: readBool(raw.aiEnabled, DEFAULT_SETTINGS.aiEnabled),
    aiBaseUrl: readStr(raw.aiBaseUrl, ''),
    aiApiKey: readStr(raw.aiApiKey, '', 500),
    aiModel: readStr(raw.aiModel, '', 200),
    aiSystemPrompt: readStr(raw.aiSystemPrompt, DEFAULT_SETTINGS.aiSystemPrompt, 2000),
    aiWelcomeMessage: readStr(raw.aiWelcomeMessage, DEFAULT_SETTINGS.aiWelcomeMessage),
    aiHandoffMessage: readStr(raw.aiHandoffMessage, DEFAULT_SETTINGS.aiHandoffMessage),
    botWebhookEnabled: readBool(raw.botWebhookEnabled, DEFAULT_SETTINGS.botWebhookEnabled),
    botWebhookUrl: readStr(raw.botWebhookUrl, ''),
  });
}

export function nativePublicConfig(settings: SupportHubSettings): {
  enabled: boolean;
  channels: SupportChannel[];
  chat: SupportChatConfig;
} {
  const channels: SupportChannel[] = [];
  if (settings.enabled && settings.telegramEnabled && settings.telegramLink) {
    channels.push({ kind: 'telegram', label: 'Telegram', href: settings.telegramLink });
  }
  if (settings.enabled && settings.whatsappEnabled && settings.whatsappLink) {
    channels.push({ kind: 'whatsapp', label: 'WhatsApp', href: settings.whatsappLink });
  }
  if (settings.enabled && settings.feishuEnabled && settings.feishuLink) {
    channels.push({ kind: 'feishu', label: 'Feishu/Lark', href: settings.feishuLink });
  }
  if (settings.enabled && settings.httpsChatEnabled && settings.httpsChatUrl) {
    channels.push({ kind: 'https', label: 'Chat', href: settings.httpsChatUrl });
  }
  return {
    enabled: settings.enabled,
    channels,
    chat: {
      enabled: settings.enabled && settings.chatEnabled,
      welcomeMessage: settings.aiWelcomeMessage || DEFAULT_SETTINGS.aiWelcomeMessage,
    },
  };
}

export function validateSupportHubSettings(input: Record<string, unknown>): string | null {
  const channels: Array<[string, unknown, unknown]> = [
    ['telegram', input.telegramEnabled, input.telegramLink],
    ['whatsapp', input.whatsappEnabled, input.whatsappLink],
    ['feishu', input.feishuEnabled, input.feishuLink],
    ['https chat', input.httpsChatEnabled, input.httpsChatUrl],
  ];
  for (const [label, enabledFlag, linkField] of channels) {
    if (enabledFlag === true) {
      const link = typeof linkField === 'string' ? linkField.trim() : '';
      if (!link) return `${label} is enabled but its link is empty`;
      if (!/^https?:\/\//.test(link)) return `${label} link must be an http(s) URL`;
    }
  }
  if (typeof input.retentionDays === 'number' && (!Number.isFinite(input.retentionDays) || input.retentionDays < 0 || input.retentionDays > 3650)) {
    return 'retentionDays must be between 0 and 3650';
  }
  if (input.aiEnabled === true) {
    const baseUrl = typeof input.aiBaseUrl === 'string' ? input.aiBaseUrl.trim() : '';
    if (!baseUrl) return 'AI assistant is enabled but aiBaseUrl is empty';
    if (!/^https?:\/\//.test(baseUrl)) return 'aiBaseUrl must be an http(s) URL';
    if (typeof input.aiApiKey !== 'string' || !input.aiApiKey.trim()) return 'AI assistant is enabled but aiApiKey is empty';
    if (typeof input.aiModel !== 'string' || !input.aiModel.trim()) return 'AI assistant is enabled but aiModel is empty';
  }
  if (input.botWebhookEnabled === true) {
    const webhookUrl = typeof input.botWebhookUrl === 'string' ? input.botWebhookUrl.trim() : '';
    if (!webhookUrl) return 'Bot webhook is enabled but botWebhookUrl is empty';
    if (!/^https?:\/\//.test(webhookUrl)) return 'botWebhookUrl must be an http(s) URL';
  }
  return null;
}

function success(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': RUNTIME } });
}

function failure(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': RUNTIME },
  });
}

async function loadSettings(env: SupportHubEnv): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare(
    "SELECT config_json FROM native_plugin_instances WHERE plugin_slug = 'support-hub' AND instance_key = 'default'",
  ).first<{ config_json: string }>();
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.config_json) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function saveSettings(env: SupportHubEnv, settings: SupportHubSettings): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_plugin_instances
     (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, created_at, updated_at)
     VALUES (?1, 'support-hub', 'default', 1, ?2, '{}', ?3, ?3)
     ON CONFLICT(plugin_slug, instance_key)
     DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`,
  ).bind(crypto.randomUUID(), JSON.stringify(settings), now).run();
}

// ---------------------------------------------------------------------------
// Chat persistence + AI reply (D1 + fetch)
// ---------------------------------------------------------------------------

function sanitizeVisitorToken(input: unknown): string | null {
  return typeof input === 'string' && VISITOR_TOKEN_PATTERN.test(input) ? input : null;
}

function sanitizeMessage(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MESSAGE_MAX_LENGTH) return null;
  return trimmed;
}

function sanitizeConversationId(input: unknown): string | null {
  return typeof input === 'string' && VISITOR_TOKEN_PATTERN.test(input) ? input : null;
}

export function buildNativeAiRequestUrl(baseUrl: string): string {
  const trimmedBase = baseUrl.trim().replace(/\/+$/, '');
  return trimmedBase.endsWith('/chat/completions') ? trimmedBase : `${trimmedBase}/chat/completions`;
}

interface AiCompletionPayload {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
}

export function buildNativeAiPayload(
  settings: SupportHubSettings,
  history: Array<{ role: 'visitor' | 'assistant'; content: string }>,
  message: string,
): AiCompletionPayload {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: settings.aiSystemPrompt || DEFAULT_SETTINGS.aiSystemPrompt },
    ...history.slice(-AI_HISTORY_LIMIT).map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content,
    })),
    { role: 'user', content: message },
  ];
  return { model: settings.aiModel.trim(), messages, temperature: 0.4 };
}

export function parseNativeAiReply(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return null;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content !== 'string' || !content.trim()) return null;
  return content.trim().slice(0, MESSAGE_MAX_LENGTH);
}

export function buildNativeHandoffReply(settings: SupportHubSettings): { content: string; actions: SupportChatAction[] } {
  const { channels } = nativePublicConfig(settings);
  return {
    content: settings.aiHandoffMessage || DEFAULT_SETTINGS.aiHandoffMessage,
    actions: channels,
  };
}

async function requestAiReply(
  env: SupportHubEnv,
  settings: SupportHubSettings,
  history: Array<{ role: 'visitor' | 'assistant'; content: string }>,
  message: string,
): Promise<string | null> {
  if (!settings.aiEnabled) return null;
  const baseUrl = settings.aiBaseUrl.trim();
  const apiKey = settings.aiApiKey.trim();
  const model = settings.aiModel.trim();
  if (!baseUrl || !apiKey || !model) return null;
  try {
    const response = await fetch(buildNativeAiRequestUrl(baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildNativeAiPayload(settings, history, message)),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return parseNativeAiReply(await response.json());
  } catch {
    return null;
  }
}

async function executeBotWebhook(
  env: SupportHubEnv,
  settings: SupportHubSettings,
  event: Record<string, unknown>,
): Promise<void> {
  if (!settings.botWebhookEnabled) return;
  const url = settings.botWebhookUrl.trim();
  if (!url || !/^https?:\/\//.test(url)) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch {
    // Bot webhook delivery is best-effort by contract; failures never break chat.
  }
}

interface ConversationRecord {
  id: string;
  visitor_token: string;
  message_count: number;
}

async function ensureConversation(
  env: SupportHubEnv,
  installationId: string,
  visitorToken: string,
  conversationId: string | null,
): Promise<ConversationRecord | null> {
  if (conversationId) {
    const row = await env.DB.prepare(
      `SELECT id, visitor_token, message_count FROM native_support_hub_conversations
       WHERE id = ?1 AND installation_id = ?2 AND visitor_token = ?3 LIMIT 1`,
    ).bind(conversationId, installationId, visitorToken).first<ConversationRecord>();
    return row ?? null;
  }
  const existing = await env.DB.prepare(
    `SELECT id, visitor_token, message_count FROM native_support_hub_conversations
     WHERE installation_id = ?1 AND visitor_token = ?2 LIMIT 1`,
  ).bind(installationId, visitorToken).first<ConversationRecord>();
  if (existing) return existing;
  const id = `shconv_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_support_hub_conversations (id, installation_id, visitor_token, status, message_count, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'open', 0, ?4, ?4)
     ON CONFLICT(installation_id, visitor_token) DO NOTHING`,
  ).bind(id, installationId, visitorToken, now).run();
  const created = await env.DB.prepare(
    'SELECT id, visitor_token, message_count FROM native_support_hub_conversations WHERE id = ?1 LIMIT 1',
  ).bind(id).first<ConversationRecord>();
  if (created) return created;
  return await env.DB.prepare(
    `SELECT id, visitor_token, message_count FROM native_support_hub_conversations
     WHERE installation_id = ?1 AND visitor_token = ?2 LIMIT 1`,
  ).bind(installationId, visitorToken).first<ConversationRecord>();
}

interface MessageRecord {
  id: string;
  role: string;
  content: string;
  actions_json: string | null;
  created_at: string;
}

function toChatMessage(row: MessageRecord): SupportChatMessage {
  let actions: SupportChatAction[] | undefined;
  if (row.actions_json) {
    try {
      const parsed: unknown = JSON.parse(row.actions_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        actions = parsed
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
          .map((entry) => ({
            kind: String(entry.kind ?? 'https'),
            label: String(entry.label ?? 'Contact'),
            href: String(entry.href ?? ''),
          }));
      }
    } catch {
      actions = undefined;
    }
  }
  return {
    id: row.id,
    role: row.role === 'assistant' ? 'assistant' : 'visitor',
    content: row.content,
    ...(actions && actions.length ? { actions } : {}),
    createdAt: row.created_at,
  };
}

async function insertChatMessage(
  env: SupportHubEnv,
  installationId: string,
  conversationId: string,
  role: 'visitor' | 'assistant',
  content: string,
  actions?: SupportChatAction[],
): Promise<SupportChatMessage> {
  const id = `shmsg_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const actionsJson = actions && actions.length ? JSON.stringify(actions) : null;
  await env.DB.prepare(
    `INSERT INTO native_support_hub_messages (id, conversation_id, installation_id, role, content, actions_json, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(id, conversationId, installationId, role, content, actionsJson, createdAt).run();
  await env.DB.prepare(
    'UPDATE native_support_hub_conversations SET message_count = message_count + 1, updated_at = ?2 WHERE id = ?1',
  ).bind(conversationId, new Date().toISOString()).run();
  return {
    id,
    role,
    content,
    ...(actions && actions.length ? { actions } : {}),
    createdAt,
  };
}

async function conversationHistory(
  env: SupportHubEnv,
  conversationId: string,
): Promise<Array<{ role: 'visitor' | 'assistant'; content: string }>> {
  const result = await env.DB.prepare(
    `SELECT id, role, content, actions_json, created_at FROM native_support_hub_messages
     WHERE conversation_id = ?1 ORDER BY created_at ASC LIMIT 200`,
  ).bind(conversationId).all<MessageRecord>();
  return (result.results ?? [])
    .filter((row) => !row.actions_json)
    .slice(-AI_HISTORY_LIMIT)
    .map((row) => ({
      role: row.role === 'assistant' ? ('assistant' as const) : ('visitor' as const),
      content: row.content,
    }));
}

async function recentVisitorMessageCount(
  env: SupportHubEnv,
  installationId: string,
  visitorToken: string,
): Promise<number> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM native_support_hub_messages m
     JOIN native_support_hub_conversations c ON c.id = m.conversation_id
     WHERE c.installation_id = ?1 AND c.visitor_token = ?2 AND m.role = 'visitor' AND m.created_at > ?3`,
  ).bind(installationId, visitorToken, cutoff).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function tryNativeSupportHub(
  request: Request,
  env: SupportHubEnv,
  scheduleBackground?: (promise: Promise<unknown>) => void,
): Promise<Response | null> {
  const url = new URL(request.url);
  // Native mount (bare /plugins/support-hub/* normalized to /api/v1/plugins/...
  // by normalizePublicApiRequest) and the plugin gateway alias both reduce to
  // the same /store/* and /admin/* tail.
  const mountBase = '/api/v1/plugins/support-hub';
  const gatewayBase = '/api/v1/extensions/plugin/support-hub/api';
  let path: string | null = null;
  if (url.pathname === mountBase || url.pathname.startsWith(`${mountBase}/`)) {
    path = url.pathname.slice(mountBase.length) || '/';
  } else if (url.pathname === gatewayBase || url.pathname.startsWith(`${gatewayBase}/`)) {
    path = url.pathname.slice(gatewayBase.length) || '/';
  }
  if (path === null) return null;
  if (!(await isNativePluginEnabled(env, 'support-hub'))) {
    return failure(404, 'PLUGIN_NOT_ENABLED', 'Support Hub is not installed and enabled');
  }

  if (request.method === 'GET' && path === '/store/health') {
    return Response.json({ status: 'healthy', plugin: 'support-hub', version: PLUGIN_VERSION }, {
      headers: { 'x-jiffoo-runtime': RUNTIME },
    });
  }

  if (request.method === 'GET' && path === '/store/config') {
    return success(nativePublicConfig(normalizeSettings(await loadSettings(env))));
  }

  if (request.method === 'POST' && path === '/store/chat/messages') {
    const settings = normalizeSettings(await loadSettings(env));
    if (!settings.enabled || !settings.chatEnabled) {
      return failure(404, 'CHAT_DISABLED', 'Support chat is not enabled');
    }
    const body = await request.json<Record<string, unknown>>().catch(() => null);
    if (!body || typeof body !== 'object') {
      return failure(400, 'VALIDATION_ERROR', 'Chat body must be an object');
    }
    const visitorToken = sanitizeVisitorToken(body.visitorToken);
    if (!visitorToken) {
      return failure(400, 'VALIDATION_ERROR', 'visitorToken must match [A-Za-z0-9_-]{8,128}');
    }
    const message = sanitizeMessage(body.message);
    if (!message) {
      return failure(400, 'VALIDATION_ERROR', `message must be 1-${MESSAGE_MAX_LENGTH} characters`);
    }
    const conversationId = sanitizeConversationId(body.conversationId);
    const installationId = 'default';
    if ((await recentVisitorMessageCount(env, installationId, visitorToken)) >= RATE_LIMIT_MAX_VISITOR_MESSAGES) {
      return failure(429, 'RATE_LIMITED', 'Too many messages, please slow down');
    }
    const conversation = await ensureConversation(env, installationId, visitorToken, conversationId);
    if (!conversation) {
      return failure(404, 'CONVERSATION_NOT_FOUND', 'Conversation does not exist for this visitor');
    }
    const visitorMessage = await insertChatMessage(env, installationId, conversation.id, 'visitor', message);
    const history = await conversationHistory(env, conversation.id);
    const aiReply = await requestAiReply(env, settings, history, message);
    let reply: SupportChatMessage;
    if (aiReply) {
      reply = await insertChatMessage(env, installationId, conversation.id, 'assistant', aiReply);
    } else {
      const handoff = buildNativeHandoffReply(settings);
      reply = await insertChatMessage(env, installationId, conversation.id, 'assistant', handoff.content, handoff.actions);
    }
    const webhookRun = executeBotWebhook(env, settings, {
      event: 'support_hub.chat.reply',
      installationId,
      conversationId: conversation.id,
      visitorToken,
      visitorMessage: { id: visitorMessage.id, content: visitorMessage.content, createdAt: visitorMessage.createdAt },
      reply: { id: reply.id, content: reply.content, createdAt: reply.createdAt },
    }).catch(() => undefined);
    if (scheduleBackground) {
      scheduleBackground(webhookRun);
    }
    return success({ conversationId: conversation.id, visitorMessage, reply });
  }

  if (request.method === 'GET' && path === '/store/chat/history') {
    const settings = normalizeSettings(await loadSettings(env));
    if (!settings.enabled || !settings.chatEnabled) {
      return failure(404, 'CHAT_DISABLED', 'Support chat is not enabled');
    }
    const visitorToken = sanitizeVisitorToken(url.searchParams.get('visitorToken'));
    if (!visitorToken) {
      return failure(400, 'VALIDATION_ERROR', 'visitorToken must match [A-Za-z0-9_-]{8,128}');
    }
    const conversationId = sanitizeConversationId(url.searchParams.get('conversationId'));
    const conversation = await ensureConversation(env, 'default', visitorToken, conversationId);
    if (!conversation) {
      return success({ conversationId: null, messages: [] });
    }
    const result = await env.DB.prepare(
      `SELECT id, role, content, actions_json, created_at FROM native_support_hub_messages
       WHERE conversation_id = ?1 ORDER BY created_at ASC LIMIT 100`,
    ).bind(conversation.id).all<MessageRecord>();
    const cutoff = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;
    const messages = (result.results ?? [])
      .map(toChatMessage)
      .filter((entry) => new Date(entry.createdAt).getTime() >= cutoff);
    return success({ conversationId: conversation.id, messages });
  }

  if (path.startsWith('/admin/')) {
    const admin = await authenticateNativeAdmin(request, env);
    if (!admin) return failure(401, 'UNAUTHORIZED', 'Administrator authentication is required');

    if (request.method === 'GET' && path === '/admin/settings') {
      return success(normalizeSettings(await loadSettings(env)));
    }

    if (request.method === 'PUT' && path === '/admin/settings') {
      const body = await request.json<Record<string, unknown>>().catch(() => null);
      if (!body || typeof body !== 'object') return failure(400, 'VALIDATION_ERROR', 'Settings body must be an object');
      const invalid = validateSupportHubSettings(body);
      if (invalid) return failure(400, 'SUPPORT_HUB_SETTINGS_INVALID', invalid);
      const merged = normalizeSettings(body);
      await saveSettings(env, merged);
      return success(merged);
    }

    if (request.method === 'GET' && path === '/admin/conversations') {
      const result = await env.DB.prepare(
        `SELECT c.id, c.visitor_token AS visitorToken, c.status, c.message_count AS messageCount,
                c.created_at AS createdAt, c.updated_at AS updatedAt
         FROM native_support_hub_conversations c
         WHERE c.installation_id = 'default'
         ORDER BY c.updated_at DESC LIMIT 50`,
      ).all<Record<string, unknown>>();
      const conversations = (result.results ?? []).map((row) => ({
        id: String(row.id),
        visitorToken: String(row.visitorToken),
        status: String(row.status),
        messageCount: Number(row.messageCount ?? 0),
        lastMessage: null as string | null,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
      }));
      for (const conversation of conversations) {
        const last = await env.DB.prepare(
          'SELECT content FROM native_support_hub_messages WHERE conversation_id = ?1 ORDER BY created_at DESC LIMIT 1',
        ).bind(conversation.id).first<{ content: string }>();
        conversation.lastMessage = last?.content ?? null;
      }
      return success({ conversations });
    }

    const conversationMessagesMatch = path.match(/^\/admin\/conversations\/([A-Za-z0-9_-]{8,128})\/messages$/);
    if (request.method === 'GET' && conversationMessagesMatch) {
      const conversationId = conversationMessagesMatch[1];
      const conversation = await env.DB.prepare(
        `SELECT id, visitor_token FROM native_support_hub_conversations
         WHERE id = ?1 AND installation_id = 'default' LIMIT 1`,
      ).bind(conversationId).first<{ id: string; visitor_token: string }>();
      if (!conversation) {
        return failure(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
      }
      const result = await env.DB.prepare(
        `SELECT id, role, content, actions_json, created_at FROM native_support_hub_messages
         WHERE conversation_id = ?1 ORDER BY created_at ASC LIMIT 200`,
      ).bind(conversationId).all<MessageRecord>();
      return success({
        conversationId,
        visitorToken: conversation.visitor_token,
        messages: (result.results ?? []).map(toChatMessage),
      });
    }
  }

  return failure(404, 'NOT_FOUND', `Unknown Support Hub route: ${request.method} ${url.pathname}`);
}

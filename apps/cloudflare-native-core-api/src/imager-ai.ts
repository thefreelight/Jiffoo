import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';
import { getNativePluginConfig } from './plugin-settings';
import { nativeWalletBalance, nativeWalletMutate } from './native-wallet';
import { imageApiRequest, parseInlineImage } from './imager-ai-provider';

type ImagerEnv = NativeAuthEnv & { DB: D1Database; ASSETS: R2Bucket };

const PLUGIN_SLUG = 'imager-ai';
const STORE_PREFIX = `/api/v1/plugins/${PLUGIN_SLUG}/store`;
const DEFAULT_CREDIT_COST = 1;
const DEFAULT_OPENAI_MODEL = 'gpt-image-2';
const DEFAULT_IMAGE_SIZE = '1024x1024';
const MAX_PROMPT_LENGTH = 4000;
const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 100;

function reply(data: unknown, status = 200): Response {
  return Response.json(
    status < 400 ? { success: true, data } : { success: false, error: data },
    { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-imager-ai' } },
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function positiveInteger(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

interface ImagerConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  creditCost: number;
  size: string;
}

async function readConfig(env: ImagerEnv): Promise<ImagerConfig | null> {
  const stored = await getNativePluginConfig(env, PLUGIN_SLUG);
  if (!stored?.enabled) return null;
  const config = stored.config;
  // Flat instance shape (baseUrl/model/apiKey) is authoritative; fall back to
  // the openai-compatible namespaced keys the K8s plugin used for portability.
  const baseUrl = optionalString(config.baseUrl)
    ?? optionalString(config.openaiCompatibleBaseUrl)
    ?? '';
  const model = optionalString(config.model)
    ?? optionalString(config.openaiCompatibleModel)
    ?? DEFAULT_OPENAI_MODEL;
  const apiKey = optionalString(config.apiKey)
    ?? optionalString(config.openaiCompatibleApiKey)
    ?? '';
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    apiKey,
    creditCost: positiveInteger(config.creditCost, DEFAULT_CREDIT_COST),
    size: optionalString(config.size) ?? DEFAULT_IMAGE_SIZE,
  };
}

interface ImageResult {
  imageUrl: string;
  rawResponse: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/\s/g, '')), (character) => character.charCodeAt(0));
}

// gpt-image models answer with base64 by default; remote URLs are also
// accepted so a provider configured for url response still works.
function extractImage(payload: unknown): { bytes: Uint8Array; contentType: string } | { url: string } | null {
  const root = record(payload);
  const output = Array.isArray(root.output) ? root.output : [];
  const data = Array.isArray(root.data) ? root.data : [];
  const candidates = [...output, ...data, root];
  for (const entry of candidates) {
    const item = record(entry);
    const encoded = optionalString(item.result) ?? optionalString(item.b64_json);
    if (encoded && !encoded.startsWith('http') && !encoded.startsWith('data:')) {
      try { return { bytes: base64ToBytes(encoded), contentType: 'image/png' }; } catch { /* not base64 */ }
    }
    const inline = parseInlineImage(item.result ?? item.url);
    if (inline) return inline;
    const url = optionalString(item.url) ?? optionalString(item.image_url);
    if (url?.startsWith('http')) return { url };
  }
  return null;
}

async function generateImage(env: ImagerEnv, config: ImagerConfig, userId: string, prompt: string, style: string | undefined, sourceImageUrl: string | undefined): Promise<ImageResult> {
  const modelPrompt = [prompt, style ? `Style: ${style}` : ''].filter(Boolean).join('\n');
  // Portable OpenAI-compatible images contract. The gateway requires the /v1
  // prefix and, for a reference image (the storefront always sends a style
  // seed as a data URL), a multipart /images/edits upload — a data URL stuffed
  // into JSON generations is what makes the upstream hang and 502.
  const providerRequest = imageApiRequest(config.baseUrl, config.model, modelPrompt, parseInlineImage(sourceImageUrl), config.size);
  const headers: Record<string, string> = { authorization: `Bearer ${config.apiKey}` };
  if (providerRequest.contentType) headers['content-type'] = providerRequest.contentType;
  const response = await fetch(providerRequest.url, { method: 'POST', headers, body: providerRequest.body });
  const rawText = await response.text().catch(() => '');
  let payload: unknown = {};
  try { payload = JSON.parse(rawText); } catch { /* non-JSON upstream body */ }
  if (!response.ok) {
    const message = optionalString(record(record(payload).error).message)
      ?? `IMAGER_PROVIDER_${response.status}${rawText ? `: ${rawText.slice(0, 160)}` : ''}`;
    throw new Error(message);
  }
  const image = extractImage(payload);
  if (!image) throw new Error('IMAGER_PROVIDER_IMAGE_MISSING');
  if ('url' in image) return { imageUrl: image.url, rawResponse: record(payload) };
  const key = `uploads/imager-ai/generated/${new Date().toISOString().slice(0, 10)}/${userId}-${crypto.randomUUID()}.png`;
  await env.ASSETS.put(key, image.bytes, { httpMetadata: { contentType: image.contentType } });
  const url = `/${key}`;
  return { imageUrl: url, rawResponse: record(payload) };
}

interface TaskRow {
  id: string;
  user_id: string;
  status: string;
  cost: number;
  wallet_balance_after: number | null;
  error_code: string | null;
  idempotency_key: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ResultRow {
  prompt: string;
  style: string | null;
  source_image_url: string | null;
  result_image_url: string | null;
  model: string | null;
}

function mapTask(task: TaskRow, result: ResultRow | null) {
  return {
    taskId: task.id,
    userId: task.user_id,
    status: task.status,
    cost: task.cost,
    walletBalanceAfter: task.wallet_balance_after,
    errorCode: task.error_code,
    createdAt: task.created_at,
    completedAt: task.completed_at,
    prompt: result?.prompt ?? null,
    style: result?.style ?? null,
    sourceImageUrl: result?.source_image_url ?? null,
    resultImageUrl: result?.result_image_url ?? null,
    model: result?.model ?? null,
  };
}

async function loadTask(env: ImagerEnv, taskId: string): Promise<{ task: TaskRow; result: ResultRow | null } | null> {
  const task = await env.DB.prepare('SELECT * FROM native_imager_tasks WHERE id = ?1').bind(taskId).first<TaskRow>();
  if (!task) return null;
  const result = await env.DB.prepare(
    'SELECT prompt, style, source_image_url, result_image_url, model FROM native_imager_results WHERE task_id = ?1 LIMIT 1',
  ).bind(taskId).first<ResultRow>();
  return { task, result: result ?? null };
}

async function handleConfig(env: ImagerEnv): Promise<Response> {
  const config = await readConfig(env);
  return reply({
    creditCost: config?.creditCost ?? DEFAULT_CREDIT_COST,
    activeProvider: 'openai-compatible',
    configured: Boolean(config),
    model: config?.model ?? null,
    image: { ready: Boolean(config), model: config?.model ?? null },
    imageReady: Boolean(config),
    styles: ['product', 'lifestyle', 'studio'],
    generateEndpoint: `${STORE_PREFIX}/generate`,
    historyEndpoint: `${STORE_PREFIX}/history`,
  });
}

async function handleGenerate(env: ImagerEnv, request: Request): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const body = await request.json<Record<string, unknown>>().catch(() => null);
  const prompt = optionalString(body?.prompt);
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return reply({ code: 'VALIDATION_ERROR', message: 'A non-empty prompt is required' }, 400);
  }
  const style = optionalString(body?.style);
  const sourceImageUrl = optionalString(body?.sourceImageUrl);
  const idempotencyKey = optionalString(body?.idempotencyKey);

  if (idempotencyKey) {
    const existing = await env.DB.prepare('SELECT * FROM native_imager_tasks WHERE idempotency_key = ?1').bind(idempotencyKey).first<TaskRow>();
    if (existing) {
      if (existing.user_id !== user.id) return reply({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key already used' }, 409);
      const loaded = await loadTask(env, existing.id);
      return reply(mapTask(existing, loaded?.result ?? null), existing.status === 'failed' ? 502 : 200);
    }
  }

  const config = await readConfig(env);
  if (!config) return reply({ code: 'IMAGER_NOT_CONFIGURED', message: 'Image provider is not configured' }, 503);

  const balance = await nativeWalletBalance(env, user.id);
  if (balance.availableBalance < config.creditCost) {
    return reply({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough credits for this generation' }, 402);
  }

  const taskId = `imager_task_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO native_imager_tasks (id, user_id, status, cost, idempotency_key, created_at, updated_at)
       VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?5)`,
    ).bind(taskId, user.id, config.creditCost, idempotencyKey ?? null, now).run();
  } catch {
    // A concurrent request won the idempotency race; return its task.
    if (idempotencyKey) {
      const winner = await env.DB.prepare('SELECT * FROM native_imager_tasks WHERE idempotency_key = ?1').bind(idempotencyKey).first<TaskRow>();
      if (winner) {
        const loaded = await loadTask(env, winner.id);
        return reply(mapTask(winner, loaded?.result ?? null));
      }
    }
    throw new Error('IMAGER_TASK_INSERT_FAILED');
  }

  let image: ImageResult;
  try {
    image = await generateImage(env, config, user.id, prompt, style, sourceImageUrl);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'IMAGER_GENERATION_FAILED';
    await env.DB.prepare(
      `UPDATE native_imager_tasks SET status = 'failed', error_code = ?2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1`,
    ).bind(taskId, errorCode).run();
    // Provider-first billing: a failed render never debits, so no refund is owed.
    return reply({ code: 'IMAGER_GENERATION_FAILED', message: errorCode }, 502);
  }

  let walletAfter = balance.balance;
  if (config.creditCost > 0) {
    const debited = await nativeWalletMutate(env, {
      userId: user.id,
      amount: config.creditCost,
      operation: 'debit',
      idempotencyKey: `imager-ai:generation:${taskId}`,
      type: 'generation',
      description: `AI image generation${style ? ` (${style})` : ''}`,
      sourcePlugin: PLUGIN_SLUG,
      referenceId: taskId,
      metadata: { prompt, style: style ?? null, sourceImageUrl: sourceImageUrl ?? null },
    });
    walletAfter = debited.balance;
  }

  const resultId = `imager_result_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO native_imager_results (id, task_id, user_id, prompt, style, source_image_url, result_image_url, model, raw_response, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    ).bind(resultId, taskId, user.id, prompt, style ?? null, sourceImageUrl ?? null, image.imageUrl, config.model, JSON.stringify(image.rawResponse), now),
    env.DB.prepare(
      `UPDATE native_imager_tasks SET status = 'completed', wallet_balance_after = ?2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1`,
    ).bind(taskId, walletAfter),
  ]);

  return reply({
    taskId,
    status: 'completed',
    imageUrl: image.imageUrl,
    resultImageUrl: image.imageUrl,
    model: config.model,
    cached: false,
    styleLabel: style ?? null,
    walletBalanceAfter: walletAfter,
  });
}

async function handleTask(env: ImagerEnv, request: Request, taskId: string): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const loaded = await loadTask(env, decodeURIComponent(taskId));
  if (!loaded || loaded.task.user_id !== user.id) return reply({ code: 'TASK_NOT_FOUND', message: 'Task not found' }, 404);
  const { task, result } = loaded;
  return reply({
    status: task.status,
    imageUrl: result?.result_image_url ?? null,
    resultImageUrl: result?.result_image_url ?? null,
    error: task.error_code ?? null,
  });
}

async function handleHistory(env: ImagerEnv, request: Request): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const url = new URL(request.url);
  const limit = Math.min(positiveInteger(url.searchParams.get('limit'), HISTORY_DEFAULT_LIMIT), HISTORY_MAX_LIMIT);
  const tasks = await env.DB.prepare(
    'SELECT * FROM native_imager_tasks WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2',
  ).bind(user.id, limit).all<TaskRow>();
  const results = await env.DB.prepare(
    `SELECT r.task_id AS taskId, r.prompt, r.style, r.source_image_url, r.result_image_url, r.model
     FROM native_imager_results r JOIN native_imager_tasks t ON t.id = r.task_id
     WHERE t.user_id = ?1 ORDER BY t.created_at DESC LIMIT ?2`,
  ).bind(user.id, limit).all<ResultRow & { taskId: string }>();
  const byTask = new Map(results.results.map((row) => [row.taskId, row]));
  return reply(tasks.results.map((task) => mapTask(task, byTask.get(task.id) ?? null)));
}

export async function tryNativeImagerAi(request: Request, env: ImagerEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== STORE_PREFIX && !url.pathname.startsWith(`${STORE_PREFIX}/`)) return null;
  if (!(await isNativePluginEnabled(env, PLUGIN_SLUG))) {
    return reply({ code: 'PLUGIN_NOT_ENABLED', message: 'Imager AI plugin is not installed and enabled' }, 404);
  }
  const path = url.pathname.slice(STORE_PREFIX.length);
  if (request.method === 'GET' && path === '/config') return handleConfig(env);
  if (request.method === 'POST' && path === '/generate') return handleGenerate(env, request);
  if (request.method === 'GET' && path === '/history') return handleHistory(env, request);
  const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
  if (request.method === 'GET' && taskMatch) return handleTask(env, request, taskMatch[1]);
  return reply({ code: 'NOT_FOUND', message: 'Route not found' }, 404);
}

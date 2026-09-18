import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';
import { getNativePluginConfig } from './plugin-settings';
import { nativeWalletBalance, nativeWalletMutate } from './native-wallet';
import { imageApiBaseUrl, parseInlineImage, type InlineImage } from './imager-ai-provider';

type VideoEnv = NativeAuthEnv & { DB: D1Database; ASSETS: R2Bucket };

const PLUGIN_SLUG = 'imager-ai';
const VIDEO_PREFIX = `/api/v1/plugins/${PLUGIN_SLUG}/store/video`;
const MAX_PROMPT_LENGTH = 4000;
const DEFAULT_VIDEO_MODEL = 'sora-2';
const DEFAULT_VIDEO_COST_4 = 5;
const DEFAULT_VIDEO_COST_8 = 12;
const DEFAULT_VIDEO_COST_12 = 20;
const DURATIONS = [4, 8, 12] as const;
const RATIO_SIZES: Record<string, string> = { '16:9': '1280x720', '9:16': '720x1280', '1:1': '1024x1024' };
const MAX_SUBMIT_PER_RUN = 5;
const MAX_POLL_PER_RUN = 5;
const SUBMITTED_TIMEOUT_MINUTES = 30;
const R2_VIDEO_PREFIX = 'uploads/video-ai/generated';

function reply(data: unknown, status = 200): Response {
  return Response.json(
    status < 400 ? { success: true, data } : { success: false, error: data },
    { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-video-ai' } },
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

interface VideoConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  cost4: number;
  cost8: number;
  cost12: number;
}

function positiveInt(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

// Video shares the imager-ai gateway settings; the video-specific fields are
// optional so an image-only gateway keeps working with videoReady=false.
async function readVideoConfig(env: VideoEnv): Promise<VideoConfig | null> {
  const stored = await getNativePluginConfig(env, PLUGIN_SLUG);
  if (!stored?.enabled) return null;
  const config = stored.config;
  const baseUrl = optionalString(config.baseUrl) ?? optionalString(config.openaiCompatibleBaseUrl) ?? '';
  const apiKey = optionalString(config.apiKey) ?? optionalString(config.openaiCompatibleApiKey) ?? '';
  const videoModel = optionalString(config.videoModel) ?? optionalString(config.openaiCompatibleVideoModel);
  if (!baseUrl || !apiKey || !videoModel) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model: videoModel,
    apiKey,
    cost4: positiveInt(config.videoCost4, DEFAULT_VIDEO_COST_4),
    cost8: positiveInt(config.videoCost8, DEFAULT_VIDEO_COST_8),
    cost12: positiveInt(config.videoCost12, DEFAULT_VIDEO_COST_12),
  };
}

function costFor(config: VideoConfig, durationSec: number): number {
  if (durationSec <= 4) return config.cost4;
  if (durationSec <= 8) return config.cost8;
  return config.cost12;
}

export function videoTaskView(task: VideoTaskRow, result: VideoResultRow | null): Record<string, unknown> {
  return {
    taskId: task.id,
    userId: task.user_id,
    status: task.status,
    cost: task.cost,
    walletBalanceAfter: task.wallet_balance_after,
    errorCode: task.error_code,
    progress: task.progress,
    durationSec: result?.duration_sec ?? null,
    ratio: result?.ratio ?? null,
    prompt: result?.prompt ?? null,
    sourceImageUrl: result?.source_image_url ?? null,
    resultVideoUrl: result?.result_video_url ?? null,
    model: result?.model ?? null,
    createdAt: task.created_at,
    completedAt: task.completed_at,
  };
}

interface VideoTaskRow {
  id: string;
  user_id: string;
  status: string;
  cost: number;
  wallet_balance_after: number | null;
  error_code: string | null;
  upstream_task_id: string | null;
  upstream_status: string | null;
  progress: number | null;
  created_at: string;
  completed_at: string | null;
}

interface VideoResultRow {
  prompt: string;
  duration_sec: number | null;
  ratio: string | null;
  source_image_url: string | null;
  result_video_url: string;
  model: string | null;
}

async function loadTask(env: VideoEnv, taskId: string): Promise<{ task: VideoTaskRow; result: VideoResultRow | null } | null> {
  const task = await env.DB.prepare('SELECT * FROM native_video_tasks WHERE id = ?1').bind(taskId).first<VideoTaskRow>();
  if (!task) return null;
  const result = await env.DB.prepare(
    'SELECT prompt, duration_sec, ratio, source_image_url, result_video_url, model FROM native_video_results WHERE task_id = ?1 LIMIT 1',
  ).bind(taskId).first<VideoResultRow>();
  return { task, result };
}

async function resolveSourceImage(env: VideoEnv, sourceImageUrl: string): Promise<InlineImage | null> {
  const inline = parseInlineImage(sourceImageUrl);
  if (inline) return inline;
  if (sourceImageUrl.startsWith('/uploads/')) {
    const object = await env.ASSETS.get(sourceImageUrl.replace(/^\//, ''));
    if (!object) return null;
    const bytes = new Uint8Array(await object.arrayBuffer());
    return { bytes, contentType: object.httpMetadata?.contentType || 'image/png' };
  }
  if (/^https:\/\//.test(sourceImageUrl)) {
    const response = await fetch(sourceImageUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, contentType: response.headers.get('content-type') || 'image/png' };
  }
  return null;
}

// OpenAI-compatible async videos contract: create, poll, then download the
// finished MP4 from the content endpoint. The multipart variant carries the
// first-frame image for image-to-video.
async function submitUpstream(
  env: VideoEnv,
  config: VideoConfig,
  prompt: string,
  durationSec: number,
  ratio: string,
  source: InlineImage | null,
): Promise<{ id: string; status: string | null }> {
  const apiBase = imageApiBaseUrl(config.baseUrl);
  const size = RATIO_SIZES[ratio] ?? RATIO_SIZES['16:9'];
  let response: Response;
  if (source) {
    const form = new FormData();
    form.append('model', config.model);
    form.append('prompt', prompt);
    form.append('seconds', String(durationSec));
    form.append('size', size);
    form.append('input_reference', new Blob([source.bytes], { type: source.contentType }), `first-frame.${source.contentType.split('/')[1] || 'png'}`);
    response = await fetch(`${apiBase}/videos`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}` },
      body: form,
    });
  } else {
    response = await fetch(`${apiBase}/videos`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.model, prompt, seconds: String(durationSec), size }),
    });
  }
  const rawText = await response.text().catch(() => '');
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawText) as Record<string, unknown>; } catch { /* non-JSON upstream body */ }
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `VIDEO_PROVIDER_${response.status}${rawText ? `: ${rawText.slice(0, 160)}` : ''}`);
  }
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) throw new Error('VIDEO_PROVIDER_TASK_ID_MISSING');
  return { id, status: typeof payload.status === 'string' ? payload.status : null };
}

async function pollUpstream(config: VideoConfig, upstreamTaskId: string): Promise<{ status: string; progress: number | null }> {
  const apiBase = imageApiBaseUrl(config.baseUrl);
  const response = await fetch(`${apiBase}/videos/${encodeURIComponent(upstreamTaskId)}`, {
    headers: { authorization: `Bearer ${config.apiKey}` },
  });
  const rawText = await response.text().catch(() => '');
  if (!response.ok) return { status: 'submitted', progress: null };
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawText) as Record<string, unknown>; } catch { return { status: 'submitted', progress: null }; }
  const status = typeof payload.status === 'string' ? payload.status : 'submitted';
  const progress = typeof payload.progress === 'number' ? Math.max(0, Math.min(100, Math.round(payload.progress))) : null;
  return { status, progress };
}

async function downloadUpstreamVideo(config: VideoConfig, upstreamTaskId: string): Promise<Uint8Array> {
  const apiBase = imageApiBaseUrl(config.baseUrl);
  const response = await fetch(`${apiBase}/videos/${encodeURIComponent(upstreamTaskId)}/content`, {
    headers: { authorization: `Bearer ${config.apiKey}` },
  });
  if (!response.ok) throw new Error(`VIDEO_PROVIDER_CONTENT_${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function handleConfig(env: VideoEnv): Promise<Response> {
  const config = await readVideoConfig(env);
  return reply({
    videoReady: Boolean(config),
    model: config?.model ?? null,
    durations: [...DURATIONS],
    ratios: Object.keys(RATIO_SIZES),
    costs: config ? { 4: config.cost4, 8: config.cost8, 12: config.cost12 } : null,
    generateEndpoint: `${VIDEO_PREFIX}/generate`,
  });
}

async function handleGenerate(env: VideoEnv, request: Request): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const body = await request.json<Record<string, unknown>>().catch(() => null);
  const prompt = optionalString(body?.prompt);
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return reply({ code: 'VALIDATION_ERROR', message: 'A non-empty prompt is required' }, 400);
  }
  const durationSec = positiveInt(body?.durationSec, 4);
  if (!(DURATIONS as readonly number[]).includes(durationSec)) {
    return reply({ code: 'VALIDATION_ERROR', message: 'durationSec must be 4, 8, or 12' }, 400);
  }
  const ratio = optionalString(body?.ratio) ?? '16:9';
  if (!RATIO_SIZES[ratio]) {
    return reply({ code: 'VALIDATION_ERROR', message: 'ratio must be 16:9, 9:16, or 1:1' }, 400);
  }
  const sourceImageUrl = optionalString(body?.sourceImageUrl);
  const idempotencyKey = optionalString(body?.idempotencyKey);

  if (idempotencyKey) {
    const existing = await env.DB.prepare('SELECT * FROM native_video_tasks WHERE idempotency_key = ?1').bind(idempotencyKey).first<VideoTaskRow>();
    if (existing) {
      if (existing.user_id !== user.id) return reply({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key already used' }, 409);
      const loaded = await loadTask(env, existing.id);
      return reply(videoTaskView(existing, loaded?.result ?? null), existing.status === 'failed' ? 502 : 200);
    }
  }

  const config = await readVideoConfig(env);
  if (!config) return reply({ code: 'VIDEO_NOT_CONFIGURED', message: 'Video engine is not configured' }, 503);

  const cost = costFor(config, durationSec);
  const balance = await nativeWalletBalance(env, user.id);
  if (balance.availableBalance < cost) {
    return reply({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough credits for this video generation' }, 402);
  }

  const taskId = `video_task_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO native_video_tasks (id, user_id, status, cost, idempotency_key, created_at, updated_at)
         VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?5)`,
      ).bind(taskId, user.id, cost, idempotencyKey ?? null, now),
      env.DB.prepare(
        `INSERT INTO native_video_results (id, task_id, user_id, prompt, duration_sec, ratio, source_image_url, result_video_url, model)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '', ?8)`,
      ).bind(`video_result_${crypto.randomUUID()}`, taskId, user.id, prompt, durationSec, ratio, sourceImageUrl ?? null, config.model),
    ]);
  } catch {
    if (idempotencyKey) {
      const winner = await env.DB.prepare('SELECT * FROM native_video_tasks WHERE idempotency_key = ?1').bind(idempotencyKey).first<VideoTaskRow>();
      if (winner) {
        const loaded = await loadTask(env, winner.id);
        return reply(videoTaskView(winner, loaded?.result ?? null));
      }
    }
    throw new Error('VIDEO_TASK_INSERT_FAILED');
  }
  return reply(videoTaskView(
    { id: taskId, user_id: user.id, status: 'pending', cost, wallet_balance_after: null, error_code: null, upstream_task_id: null, upstream_status: null, progress: null, created_at: now, completed_at: null },
    { prompt, duration_sec: durationSec, ratio, source_image_url: sourceImageUrl ?? null, result_video_url: '', model: config.model },
  ), 202);
}

async function handleTask(env: VideoEnv, request: Request, taskId: string): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const loaded = await loadTask(env, taskId);
  if (!loaded || loaded.task.user_id !== user.id) return reply({ code: 'NOT_FOUND', message: 'Task not found' }, 404);
  return reply(videoTaskView(loaded.task, loaded.result));
}

async function handleHistory(env: VideoEnv, request: Request): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const rows = await env.DB.prepare(
    'SELECT * FROM native_video_tasks WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 50',
  ).bind(user.id).all<VideoTaskRow>();
  const items: Array<Record<string, unknown>> = [];
  for (const row of rows.results) {
    const loaded = await loadTask(env, row.id);
    items.push(videoTaskView(row, loaded?.result ?? null));
  }
  return reply(items);
}

export async function tryNativeVideoAi(request: Request, env: VideoEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== VIDEO_PREFIX && !url.pathname.startsWith(`${VIDEO_PREFIX}/`)) return null;
  if (!(await isNativePluginEnabled(env, PLUGIN_SLUG))) {
    return reply({ code: 'PLUGIN_NOT_ENABLED', message: 'Imager AI plugin is not installed and enabled' }, 404);
  }
  const path = url.pathname.slice(VIDEO_PREFIX.length);
  if (request.method === 'GET' && path === '/config') return handleConfig(env);
  if (request.method === 'POST' && path === '/generate') return handleGenerate(env, request);
  if (request.method === 'GET' && path === '/history') return handleHistory(env, request);
  const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
  if (request.method === 'GET' && taskMatch) return handleTask(env, request, taskMatch[1]);
  return reply({ code: 'NOT_FOUND', message: 'Route not found' }, 404);
}

// Cron-driven worker for the async video pipeline: submit queued tasks to the
// upstream, poll submitted ones, download finished MP4s into R2, and only then
// debit the wallet (a failed or timed-out video never charges the user).
export async function processNativeVideoTasks(env: VideoEnv): Promise<{ submitted: number; polled: number; completed: number; failed: number }> {
  const summary = { submitted: 0, polled: 0, completed: 0, failed: 0 };
  const config = await readVideoConfig(env);
  if (!config) return summary;

  const pending = await env.DB.prepare(
    "SELECT * FROM native_video_tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?1",
  ).bind(MAX_SUBMIT_PER_RUN).all<VideoTaskRow & { idempotency_key: string | null }>();
  for (const task of pending.results) {
    const loaded = await loadTask(env, task.id);
    const result = loaded?.result;
    if (!result) continue;
    try {
      const source = result.source_image_url ? await resolveSourceImage(env, result.source_image_url) : null;
      const submitted = await submitUpstream(env, config, result.prompt, result.duration_sec ?? 4, result.ratio ?? '16:9', source);
      await env.DB.prepare(
        "UPDATE native_video_tasks SET status = 'submitted', upstream_task_id = ?2, upstream_status = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'pending'",
      ).bind(task.id, submitted.id, submitted.status).run();
      summary.submitted += 1;
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : 'VIDEO_SUBMISSION_FAILED';
      await env.DB.prepare(
        "UPDATE native_video_tasks SET status = 'failed', error_code = ?2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'pending'",
      ).bind(task.id, errorCode.slice(0, 300)).run();
      summary.failed += 1;
    }
  }

  const submitted = await env.DB.prepare(
    `SELECT * FROM native_video_tasks WHERE status = 'submitted' ORDER BY updated_at ASC LIMIT ?1`,
  ).bind(MAX_POLL_PER_RUN).all<VideoTaskRow & { created_at: string; updated_at: string }>();
  for (const task of submitted.results) {
    summary.polled += 1;
    if (!task.upstream_task_id) {
      await env.DB.prepare(
        "UPDATE native_video_tasks SET status = 'failed', error_code = 'VIDEO_UPSTREAM_ID_MISSING', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
      ).bind(task.id).run();
      summary.failed += 1;
      continue;
    }
    const ageMinutes = (Date.now() - Date.parse(task.updated_at)) / 60000;
    if (ageMinutes > SUBMITTED_TIMEOUT_MINUTES) {
      await env.DB.prepare(
        "UPDATE native_video_tasks SET status = 'failed', error_code = 'VIDEO_UPSTREAM_TIMEOUT', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
      ).bind(task.id).run();
      summary.failed += 1;
      continue;
    }
    let upstreamStatus: string;
    let progress: number | null;
    try {
      const polled = await pollUpstream(config, task.upstream_task_id);
      upstreamStatus = polled.status;
      progress = polled.progress;
    } catch {
      continue; // transient poll failure; retry next run
    }
    if (upstreamStatus === 'completed') {
      const loaded = await loadTask(env, task.id);
      const result = loaded?.result;
      if (!result) continue;
      try {
        const bytes = await downloadUpstreamVideo(config, task.upstream_task_id);
        const key = `${R2_VIDEO_PREFIX}/${new Date().toISOString().slice(0, 10)}/${task.user_id}-${crypto.randomUUID()}.mp4`;
        await env.ASSETS.put(key, bytes, { httpMetadata: { contentType: 'video/mp4' } });
        const balance = await nativeWalletMutate(env, {
          userId: task.user_id,
          amount: task.cost,
          operation: 'debit',
          idempotencyKey: `video-ai:generation:${task.id}`,
          type: 'generation',
          description: `AI video generation (${result.duration_sec ?? 4}s)`,
          sourcePlugin: PLUGIN_SLUG,
          referenceId: task.id,
        });
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE native_video_results SET result_video_url = ?2, model = ?3 WHERE task_id = ?1",
          ).bind(task.id, `/${key}`, config.model),
          env.DB.prepare(
            "UPDATE native_video_tasks SET status = 'completed', wallet_balance_after = ?2, progress = 100, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'submitted'",
          ).bind(task.id, balance.balance),
        ]);
        summary.completed += 1;
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : 'VIDEO_DOWNLOAD_FAILED';
        await env.DB.prepare(
          "UPDATE native_video_tasks SET status = 'failed', error_code = ?2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'submitted'",
        ).bind(task.id, errorCode.slice(0, 300)).run();
        summary.failed += 1;
      }
      continue;
    }
    if (upstreamStatus === 'failed' || upstreamStatus === 'cancelled') {
      await env.DB.prepare(
        "UPDATE native_video_tasks SET status = 'failed', error_code = ?2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'submitted'",
      ).bind(task.id, `VIDEO_UPSTREAM_${upstreamStatus.toUpperCase()}`).run();
      summary.failed += 1;
      continue;
    }
    if (progress !== null && progress !== task.progress) {
      await env.DB.prepare(
        "UPDATE native_video_tasks SET upstream_status = ?2, progress = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
      ).bind(task.id, upstreamStatus, progress).run();
    }
  }
  return summary;
}

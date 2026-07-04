const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const VERSION = '0.1.0';
const IMAGE_MODELS = ['seededit-3-0-i2i-250628', 'seedream-4-5-250828'];
const VIDEO_MODELS = ['seedance-1-0-lite-i2v-250428', 'seedance-1-0-pro-250528'];
const DEFAULT_IMAGE_MODEL = 'seededit-3-0-i2i-250628';
const DEFAULT_VIDEO_MODEL = 'seedance-1-0-lite-i2v-250428';
const DEFAULT_IMAGE_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const DEFAULT_VIDEO_BASE_URL = 'https://prompt-pilot.ap-southeast.bytepluses.com';
const DEFAULT_IMAGE_LIMIT_MB = 8;
const DEFAULT_VIDEO_LIMIT_MB = 18;
const DEFAULT_ASSET_TTL_MINUTES = 120;
const DEFAULT_RESULT_POLL_TIMEOUT_MS = 8 * 60 * 1000;
const DEFAULT_RESULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_FREE_CREDITS = 12;
const GENERATION_CREDIT_COST = 1;

const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 80,
    price: 9,
    currency: 'USD',
    description: 'Enough for quick concept checks, thumbnails, and prompt experiments.',
  },
  {
    id: 'creator',
    name: 'Creator',
    credits: 260,
    price: 24,
    currency: 'USD',
    badge: 'Popular',
    description: 'A practical pack for campaign visuals, product directions, and iterations.',
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 720,
    price: 59,
    currency: 'USD',
    description: 'For heavier visual production runs and repeated client-facing experiments.',
  },
];

const IMAGE_STYLE_PRESETS = {
  ghibli: {
    id: 'ghibli',
    label: 'Ghibli Light',
    prompt:
      'Transform the source photo into a hand-painted Studio Ghibli inspired illustration. Preserve the subject identity, composition, clothing silhouette, and emotional tone. Use soft watercolor textures, warm natural light, lush environmental detail, clean outlines, and a whimsical cinematic atmosphere. Avoid warped anatomy, duplicate features, text, watermark, extra fingers, and oversharpened contrast.',
  },
  storybook: {
    id: 'storybook',
    label: 'Storybook Poster',
    prompt:
      'Restyle the source image as a premium storybook key art illustration. Preserve the framing and recognisable subject details while using elegant brushwork, atmospheric depth, premium print colors, and a polished editorial finish.',
  },
  watercolor: {
    id: 'watercolor',
    label: 'Watercolor Wash',
    prompt:
      'Convert the source image into a delicate watercolor illustration with paper texture, feathered pigment edges, restrained contrast, and airy negative space. Keep the composition readable and graceful.',
  },
  anime: {
    id: 'anime',
    label: 'Anime Scene',
    prompt:
      'Turn the source photo into a refined anime scene illustration with expressive linework, cel-shaded color planes, believable lighting, and a cinematic background. Preserve facial identity and pose.',
  },
};

const VIDEO_STYLE_PRESETS = {
  ghibli_motion: {
    id: 'ghibli_motion',
    label: 'Ghibli Motion',
    prompt:
      'Transform the reference video into a soft painterly Ghibli-inspired animation. Keep the same actions, shot rhythm, and camera framing. Use warm daylight, hand-painted textures, gentle linework, whimsical environmental detail, stable anatomy, and low flicker.',
  },
  filmic_story: {
    id: 'filmic_story',
    label: 'Filmic Story',
    prompt:
      'Restyle the reference video into a cinematic illustrated short with painterly textures, controlled motion, coherent subject identity, subtle parallax depth, and premium color grading. Avoid flicker, abrupt scene jumps, and duplicate limbs.',
  },
};

const ASSET_STORE = new Map();
const TASK_CACHE = new Map();

function readManifest() {
  return require('../manifest.json');
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function safeJsonParse(value, fallback = {}) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parsePluginConfig(request) {
  const header = request.headers['x-plugin-config'];
  if (typeof header !== 'string' || !header.trim()) {
    return {};
  }

  try {
    return safeJsonParse(Buffer.from(header, 'base64url').toString('utf8'), {});
  } catch {
    return {};
  }
}

function getNestedValue(source, pathParts) {
  return pathParts.reduce((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return current[key];
  }, source);
}

function resolveConfigValue(config, pathKey, envKey, fallback = '') {
  const configValue = getNestedValue(config, pathKey.split('.'));
  if (typeof configValue === 'string' && configValue.trim()) {
    return configValue.trim();
  }
  const envValue = process.env[envKey];
  if (typeof envValue === 'string' && envValue.trim()) {
    return envValue.trim();
  }
  return fallback;
}

function resolveNumberValue(config, pathKey, envKey, fallback) {
  const configValue = getNestedValue(config, pathKey.split('.'));
  if (typeof configValue === 'number' && Number.isFinite(configValue)) {
    return configValue;
  }
  const envValue = process.env[envKey];
  if (typeof envValue === 'string' && envValue.trim()) {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function resolveBooleanValue(config, pathKey, envKey, fallback = false) {
  const configValue = getNestedValue(config, pathKey.split('.'));
  if (typeof configValue === 'boolean') {
    return configValue;
  }
  const envValue = process.env[envKey];
  if (typeof envValue === 'string' && envValue.trim()) {
    return ['1', 'true', 'yes', 'on'].includes(envValue.trim().toLowerCase());
  }
  return fallback;
}

function getRequestHost(request) {
  const forwardedHost = request.headers['x-forwarded-host'];
  if (typeof forwardedHost === 'string' && forwardedHost.trim()) {
    return forwardedHost.trim().split(',')[0].trim();
  }
  const host = request.headers.host;
  return typeof host === 'string' && host.trim() ? host.trim() : '';
}

function getRequestProtocol(request) {
  const forwardedProto = request.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string' && forwardedProto.trim()) {
    return forwardedProto.trim().split(',')[0].trim();
  }
  return process.env.NODE_ENV === 'production' ? 'https' : 'http';
}

function resolvePublicBaseUrl(request, config) {
  const configured =
    resolveConfigValue(config, 'site.publicBaseUrl', 'IMAGIC_PUBLIC_BASE_URL')
    || resolveConfigValue(config, 'site.publicBaseUrl', 'NEXT_PUBLIC_SHOP_URL');

  if (configured) {
    return normalizeBaseUrl(configured);
  }

  const host = getRequestHost(request);
  if (!host) {
    return '';
  }

  return `${getRequestProtocol(request)}://${host}`;
}

function getInstallationId(request) {
  const header = request.headers['x-installation-id'];
  return typeof header === 'string' && header.trim() ? header.trim() : 'default';
}

function getRuntimeRoot(installationId) {
  const configured = process.env.IMAGIC_RUNTIME_DIR;
  const root = configured && configured.trim()
    ? configured.trim()
    : path.join(os.tmpdir(), 'jiffoo-imagic-core');
  return path.join(root, installationId);
}

function getUploadsDir(installationId) {
  return path.join(getRuntimeRoot(installationId), 'uploads');
}

function getCreditsDir() {
  const configured = process.env.IMAGIC_CREDITS_DIR;
  return configured && configured.trim()
    ? configured.trim()
    : path.join(process.cwd(), 'uploads', 'imagic-core');
}

function getCreditsFile(installationId) {
  return path.join(getCreditsDir(), `${installationId}.credits.json`);
}

function getRequestUserId(request) {
  const header = request.headers['x-user-id'];
  return typeof header === 'string' && header.trim() ? header.trim() : '';
}

function requireUserId(request) {
  const userId = getRequestUserId(request);
  if (!userId) {
    throw createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }
  return userId;
}

async function readCreditState(installationId) {
  const file = getCreditsFile(installationId);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const parsed = safeJsonParse(raw, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error && error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeCreditState(installationId, state) {
  await ensureDir(getCreditsDir());
  await fsp.writeFile(getCreditsFile(installationId), JSON.stringify(state, null, 2));
}

function getFreeCreditAmount(config) {
  return resolveNumberValue(config, 'credits.freeSignupCredits', 'IMAGIC_FREE_SIGNUP_CREDITS', DEFAULT_FREE_CREDITS);
}

async function ensureCreditAccount(request, userId) {
  const installationId = getInstallationId(request);
  const config = parsePluginConfig(request);
  const state = await readCreditState(installationId);
  const now = new Date().toISOString();
  if (!state[userId]) {
    state[userId] = {
      balance: getFreeCreditAmount(config),
      includedFreeCredits: getFreeCreditAmount(config),
      createdAt: now,
      updatedAt: now,
      ledger: [
        {
          id: crypto.randomUUID(),
          type: 'WELCOME',
          amount: getFreeCreditAmount(config),
          description: 'Welcome credits',
          createdAt: now,
        },
      ],
    };
    await writeCreditState(installationId, state);
  }
  return state[userId];
}

async function creditUser(request, userId, amount, description, type = 'CREDIT') {
  const installationId = getInstallationId(request);
  const state = await readCreditState(installationId);
  const account = state[userId] || await ensureCreditAccount(request, userId);
  const now = new Date().toISOString();
  account.balance = Number(account.balance || 0) + amount;
  account.updatedAt = now;
  account.ledger = Array.isArray(account.ledger) ? account.ledger : [];
  account.ledger.unshift({
    id: crypto.randomUUID(),
    type,
    amount,
    description,
    createdAt: now,
  });
  account.ledger = account.ledger.slice(0, 50);
  state[userId] = account;
  await writeCreditState(installationId, state);
  return account;
}

async function debitUser(request, userId, amount, description) {
  const installationId = getInstallationId(request);
  const state = await readCreditState(installationId);
  const account = state[userId] || await ensureCreditAccount(request, userId);
  if (Number(account.balance || 0) < amount) {
    throw createError('Not enough credits. Please top up before generating.', 402, 'INSUFFICIENT_CREDITS');
  }
  const now = new Date().toISOString();
  account.balance = Number(account.balance || 0) - amount;
  account.updatedAt = now;
  account.ledger = Array.isArray(account.ledger) ? account.ledger : [];
  account.ledger.unshift({
    id: crypto.randomUUID(),
    type: 'DEBIT',
    amount: -amount,
    description,
    createdAt: now,
  });
  account.ledger = account.ledger.slice(0, 50);
  state[userId] = account;
  await writeCreditState(installationId, state);
  return account;
}

function pruneRuntimeState() {
  const now = Date.now();
  for (const [assetId, asset] of ASSET_STORE.entries()) {
    if (asset.expiresAt <= now) {
      ASSET_STORE.delete(assetId);
      void fsp.rm(asset.absolutePath, { force: true }).catch(() => {});
    }
  }

  for (const [taskId, task] of TASK_CACHE.entries()) {
    if (task.expiresAt <= now) {
      TASK_CACHE.delete(taskId);
    }
  }
}

setInterval(pruneRuntimeState, 60 * 1000).unref();

function createError(message, statusCode = 500, code = 'IMAGIC_ERROR', details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function inferExtensionFromMime(mime) {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'video/webm':
      return 'webm';
    default:
      return 'bin';
  }
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw createError('Expected a base64 data URL payload', 400, 'INVALID_DATA_URL');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function isSupportedImageMime(mimeType) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType);
}

function isSupportedVideoMime(mimeType) {
  return ['video/mp4', 'video/quicktime', 'video/webm'].includes(mimeType);
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function persistAsset(request, payload) {
  const config = parsePluginConfig(request);
  const installationId = getInstallationId(request);
  const { dataUrl, filename = '', kind = 'image' } = payload || {};

  if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
    throw createError('dataUrl is required', 400, 'MISSING_DATA_URL');
  }

  const decoded = decodeDataUrl(dataUrl);
  const maxImageBytes = resolveNumberValue(config, 'limits.maxImageMb', 'IMAGIC_MAX_IMAGE_MB', DEFAULT_IMAGE_LIMIT_MB) * 1024 * 1024;
  const maxVideoBytes = resolveNumberValue(config, 'limits.maxVideoMb', 'IMAGIC_MAX_VIDEO_MB', DEFAULT_VIDEO_LIMIT_MB) * 1024 * 1024;
  const ttlMinutes = resolveNumberValue(config, 'limits.assetTtlMinutes', 'IMAGIC_ASSET_TTL_MINUTES', DEFAULT_ASSET_TTL_MINUTES);

  if (kind === 'image') {
    if (!isSupportedImageMime(decoded.mimeType)) {
      throw createError(`Unsupported image type: ${decoded.mimeType}`, 400, 'UNSUPPORTED_IMAGE_TYPE');
    }
    if (decoded.buffer.length > maxImageBytes) {
      throw createError(`Image exceeds ${Math.round(maxImageBytes / (1024 * 1024))}MB limit`, 400, 'IMAGE_TOO_LARGE');
    }
  } else if (kind === 'video') {
    if (!isSupportedVideoMime(decoded.mimeType)) {
      throw createError(`Unsupported video type: ${decoded.mimeType}`, 400, 'UNSUPPORTED_VIDEO_TYPE');
    }
    if (decoded.buffer.length > maxVideoBytes) {
      throw createError(`Video exceeds ${Math.round(maxVideoBytes / (1024 * 1024))}MB limit`, 400, 'VIDEO_TOO_LARGE');
    }
  } else {
    throw createError('kind must be "image" or "video"', 400, 'INVALID_ASSET_KIND');
  }

  const assetId = crypto.randomUUID();
  const extension = inferExtensionFromMime(decoded.mimeType);
  const uploadsDir = getUploadsDir(installationId);
  const absolutePath = path.join(uploadsDir, `${assetId}.${extension}`);
  const publicBaseUrl = resolvePublicBaseUrl(request, config);

  await ensureDir(uploadsDir);
  await fsp.writeFile(absolutePath, decoded.buffer);

  const asset = {
    id: assetId,
    installationId,
    kind,
    mimeType: decoded.mimeType,
    size: decoded.buffer.length,
    fileName: filename || `${assetId}.${extension}`,
    extension,
    absolutePath,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    publicUrl: publicBaseUrl
      ? `${publicBaseUrl}/api/extensions/plugin/imagic-core/api/media/${assetId}.${extension}?installation=${encodeURIComponent(installationId)}`
      : '',
  };

  ASSET_STORE.set(assetId, asset);
  return asset;
}

function getAssetOrThrow(assetId) {
  const asset = ASSET_STORE.get(assetId);
  if (!asset) {
    throw createError('Asset not found or expired', 404, 'ASSET_NOT_FOUND');
  }
  return asset;
}

function getImageRuntimeConfig(config) {
  return {
    apiKey: resolveConfigValue(config, 'image.apiKey', 'IMAGIC_IMAGE_API_KEY'),
    baseUrl: normalizeBaseUrl(resolveConfigValue(config, 'image.baseUrl', 'IMAGIC_IMAGE_BASE_URL', DEFAULT_IMAGE_BASE_URL)),
    model: resolveConfigValue(config, 'image.model', 'IMAGIC_IMAGE_MODEL', DEFAULT_IMAGE_MODEL),
  };
}

function getVideoRuntimeConfig(config) {
  return {
    apiKey: resolveConfigValue(config, 'video.apiKey', 'IMAGIC_VIDEO_API_KEY'),
    apiUrl: normalizeBaseUrl(resolveConfigValue(config, 'video.apiUrl', 'IMAGIC_VIDEO_API_URL', DEFAULT_VIDEO_BASE_URL)),
    workspaceId: resolveConfigValue(config, 'video.workspaceId', 'IMAGIC_VIDEO_WORKSPACE_ID'),
    model: resolveConfigValue(config, 'video.model', 'IMAGIC_VIDEO_MODEL', DEFAULT_VIDEO_MODEL),
    seedance2Experimental: resolveBooleanValue(
      config,
      'video.seedance2Experimental',
      'IMAGIC_VIDEO_SEEDANCE2_EXPERIMENTAL',
      false,
    ),
  };
}

function getImagePreset(styleId) {
  return IMAGE_STYLE_PRESETS[styleId] || IMAGE_STYLE_PRESETS.ghibli;
}

function getVideoPreset(styleId) {
  return VIDEO_STYLE_PRESETS[styleId] || VIDEO_STYLE_PRESETS.ghibli_motion;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractImageUrl(payload) {
  if (payload && Array.isArray(payload.data) && payload.data[0]) {
    return payload.data[0].url || payload.data[0].image_url || null;
  }
  return null;
}

function extractImageUrlFromLegacyContent(content) {
  const raw = String(content || '');
  const filesystemMatch = raw.match(/(https:\/\/filesystem\.site\/cdn\/[0-9]+\/[a-zA-Z0-9._-]+\.[a-z]+)/);
  if (filesystemMatch && filesystemMatch[1]) {
    return filesystemMatch[1];
  }

  const bracketMatch = raw.match(/\((https:\/\/[^)]+)\)/);
  if (bracketMatch && bracketMatch[1]) {
    return bracketMatch[1];
  }

  const markdownMatch = raw.match(/!\[.*?\]\((https:\/\/.*?\.(?:png|jpg|jpeg|webp))\)/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1];
  }

  const urlMatch = raw.match(/(https:\/\/[^\s]+\.(?:png|jpg|jpeg|webp))/);
  return urlMatch && urlMatch[1] ? urlMatch[1] : null;
}

async function createImageGeneration(request, body) {
  const config = parsePluginConfig(request);
  const runtime = getImageRuntimeConfig(config);
  if (!runtime.apiKey) {
    throw createError('Image runtime is not configured', 503, 'IMAGE_RUNTIME_NOT_CONFIGURED');
  }

  const asset = getAssetOrThrow(body && body.assetId);
  if (asset.kind !== 'image') {
    throw createError('Selected asset is not an image', 400, 'INVALID_IMAGE_ASSET');
  }
  if (!asset.publicUrl) {
    throw createError('Public base URL is missing for image generation', 500, 'PUBLIC_URL_UNAVAILABLE');
  }

  const preset = getImagePreset(body && body.styleId);
  const customPrompt = typeof body?.customPrompt === 'string' ? body.customPrompt.trim() : '';
  const prompt = customPrompt ? `${preset.prompt} ${customPrompt}` : preset.prompt;

  if (runtime.baseUrl.includes('/chat/completions')) {
    const assetBuffer = await fsp.readFile(asset.absolutePath);
    const dataUrl = `data:${asset.mimeType};base64,${assetBuffer.toString('base64')}`;

    const response = await fetch(runtime.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${runtime.apiKey}`,
      },
      body: JSON.stringify({
        model: runtime.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
      }),
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw createError(
        payload?.error?.message || payload?.message || 'Legacy image generation failed',
        response.status,
        'IMAGE_GENERATION_FAILED',
        payload,
      );
    }

    const rawContent = payload?.choices?.[0]?.message?.content || '';
    const imageUrl = extractImageUrlFromLegacyContent(rawContent);
    if (!imageUrl) {
      throw createError('Legacy image runtime returned no extractable image URL', 502, 'IMAGE_RESULT_MISSING', payload);
    }

    return {
      imageUrl,
      styleId: preset.id,
      styleLabel: preset.label,
      prompt,
      model: runtime.model,
      sourceAsset: {
        id: asset.id,
        url: asset.publicUrl || null,
        fileName: asset.fileName,
      },
      upstream: payload,
    };
  }

  const response = await fetch(`${runtime.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${runtime.apiKey}`,
    },
    body: JSON.stringify({
      model: runtime.model,
      prompt,
      image: asset.publicUrl,
      response_format: 'url',
      size: 'adaptive',
      watermark: false,
    }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw createError(
      payload?.error?.message || payload?.message || 'Image generation failed',
      response.status,
      'IMAGE_GENERATION_FAILED',
      payload,
    );
  }

  const imageUrl = extractImageUrl(payload);
  if (!imageUrl) {
    throw createError('Image runtime returned no result URL', 502, 'IMAGE_RESULT_MISSING', payload);
  }

  return {
    imageUrl,
    styleId: preset.id,
    styleLabel: preset.label,
    prompt,
    model: runtime.model,
    sourceAsset: {
      id: asset.id,
      url: asset.publicUrl,
      fileName: asset.fileName,
    },
    upstream: payload,
  };
}

async function createVideoTask(request, body) {
  const config = parsePluginConfig(request);
  const runtime = getVideoRuntimeConfig(config);
  if (!runtime.apiKey || !runtime.workspaceId) {
    throw createError('Video runtime is not configured', 503, 'VIDEO_RUNTIME_NOT_CONFIGURED');
  }

  const asset = getAssetOrThrow(body && body.assetId);
  if (asset.kind !== 'video') {
    throw createError('Selected asset is not a video', 400, 'INVALID_VIDEO_ASSET');
  }
  if (!asset.publicUrl) {
    throw createError('Public base URL is missing for video generation', 500, 'PUBLIC_URL_UNAVAILABLE');
  }

  const preset = getVideoPreset(body && body.styleId);
  const customPrompt = typeof body?.customPrompt === 'string' ? body.customPrompt.trim() : '';
  const prompt = customPrompt ? `${preset.prompt} ${customPrompt}` : preset.prompt;

  const response = await fetch(`${runtime.apiUrl}?Action=ImitateAndGenerateVideo&Version=2024-11-06`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': runtime.apiKey,
    },
    body: JSON.stringify({
      ReqKey: runtime.model,
      BinaryDataBase64: '',
      WorkSpaceID: runtime.workspaceId,
      Parameters: {
        Prompt: prompt,
        AspectRatio: body?.aspectRatio || 'adaptive',
        Duration: Number.isFinite(body?.duration) ? body.duration : 5,
        GenerateCount: 1,
        Resolution: body?.resolution || '720p',
        RefVideoUrl: asset.publicUrl,
      },
    }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw createError(
      payload?.ResponseMetadata?.Error?.Message || payload?.message || 'Video task creation failed',
      response.status,
      'VIDEO_TASK_CREATE_FAILED',
      payload,
    );
  }

  const taskId = payload?.Result?.TaskID || payload?.Result?.task_id || payload?.TaskID || null;
  if (!taskId) {
    throw createError('Video runtime returned no task ID', 502, 'VIDEO_TASK_ID_MISSING', payload);
  }

  TASK_CACHE.set(taskId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + DEFAULT_RESULT_POLL_TIMEOUT_MS,
    presetId: preset.id,
    installationId: getInstallationId(request),
  });

  return {
    taskId,
    styleId: preset.id,
    styleLabel: preset.label,
    prompt,
    model: runtime.model,
    adapter: runtime.seedance2Experimental ? 'seedance-2-experimental' : 'videopilot-seedance',
    sourceAsset: {
      id: asset.id,
      url: asset.publicUrl,
      fileName: asset.fileName,
    },
    upstream: payload,
  };
}

async function getVideoTaskResult(request, taskId) {
  const config = parsePluginConfig(request);
  const runtime = getVideoRuntimeConfig(config);
  if (!runtime.apiKey || !runtime.workspaceId) {
    throw createError('Video runtime is not configured', 503, 'VIDEO_RUNTIME_NOT_CONFIGURED');
  }

  const response = await fetch(`${runtime.apiUrl}?Action=GetTaskResult&Version=2024-11-06`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': runtime.apiKey,
    },
    body: JSON.stringify({
      TaskID: taskId,
      WorkSpaceID: runtime.workspaceId,
    }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw createError(
      payload?.ResponseMetadata?.Error?.Message || payload?.message || 'Failed to query video task',
      response.status,
      'VIDEO_TASK_STATUS_FAILED',
      payload,
    );
  }

  const status = payload?.Result?.Status || payload?.Result?.status || 'unknown';
  const videoUrl =
    payload?.Result?.VideoUrl
    || payload?.Result?.ResultVideoUrl
    || payload?.Result?.OutputVideoUrl
    || null;

  return {
    taskId,
    status: String(status).toLowerCase(),
    videoUrl,
    upstream: payload,
  };
}

function buildSetupStatus(request) {
  const config = parsePluginConfig(request);
  const image = getImageRuntimeConfig(config);
  const video = getVideoRuntimeConfig(config);

  return {
    plugin: 'imagic-core',
    version: VERSION,
    image: {
      ready: Boolean(image.apiKey),
      baseUrl: image.baseUrl || null,
      model: image.model,
      supportedModels: IMAGE_MODELS,
    },
    video: {
      ready: Boolean(video.apiKey && video.workspaceId),
      apiUrl: video.apiUrl || null,
      model: video.model,
      supportedModels: VIDEO_MODELS,
      workspaceIdConfigured: Boolean(video.workspaceId),
      adapter: video.seedance2Experimental ? 'seedance-2-experimental' : 'videopilot-seedance',
      note:
        video.seedance2Experimental
          ? 'Experimental adapter enabled. Upstream Seedance 2.x REST compatibility still depends on provider-side availability.'
          : 'Production path uses VideoPilot today because public Seedance 2.0 REST access is still limited upstream.',
    },
    presets: {
      image: Object.values(IMAGE_STYLE_PRESETS).map((preset) => ({ id: preset.id, label: preset.label })),
      video: Object.values(VIDEO_STYLE_PRESETS).map((preset) => ({ id: preset.id, label: preset.label })),
    },
  };
}

function sendError(reply, error) {
  reply.code(error && Number.isFinite(error.statusCode) ? error.statusCode : 500);
  return {
    success: false,
    error: {
      code: error && error.code ? error.code : 'IMAGIC_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      ...(error && error.details !== undefined ? { details: error.details } : {}),
    },
  };
}

async function plugin(fastify) {
  fastify.get('/health', async () => ({
    status: 'healthy',
    plugin: 'imagic-core',
    version: VERSION,
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/manifest', async () => readManifest());

  fastify.get('/api/setup-status', async (request, reply) => ({
    success: true,
    data: buildSetupStatus(request),
  }));

  fastify.get('/api/credit-packs', async () => ({
    success: true,
    data: CREDIT_PACKS,
  }));

  fastify.get('/api/credits', async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const account = await ensureCreditAccount(request, userId);
      return {
        success: true,
        data: {
          balance: Number(account.balance || 0),
          includedFreeCredits: Number(account.includedFreeCredits || 0),
          ledger: Array.isArray(account.ledger) ? account.ledger.slice(0, 12) : [],
        },
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post('/api/credit-packs/:packId/checkout', async (request, reply) => {
    try {
      const userId = requireUserId(request);
      const pack = CREDIT_PACKS.find((item) => item.id === request.params.packId);
      if (!pack) {
        throw createError('Credit pack not found', 404, 'CREDIT_PACK_NOT_FOUND');
      }
      const mvpMode = !process.env.STRIPE_SECRET_KEY;
      const existing = await ensureCreditAccount(request, userId);
      const alreadyGranted = mvpMode && Array.isArray(existing.ledger)
        ? existing.ledger.some((entry) => entry && entry.type === 'MVP_GRANT' && entry.description === `MVP credit grant: ${pack.id}`)
        : false;
      if (alreadyGranted) {
        return {
          success: true,
          data: {
            balance: Number(existing.balance || 0),
            addedCredits: 0,
            alreadyGranted: true,
            pack,
            mode: 'mvp-credit-topup',
          },
        };
      }
      const account = await creditUser(
        request,
        userId,
        pack.credits,
        mvpMode ? `MVP credit grant: ${pack.id}` : `Credit pack: ${pack.name}`,
        mvpMode ? 'MVP_GRANT' : 'PURCHASE',
      );
      return {
        success: true,
        data: {
          balance: Number(account.balance || 0),
          addedCredits: pack.credits,
          pack,
          mode: mvpMode ? 'mvp-credit-topup' : 'stripe-ready',
        },
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post('/api/uploads', { bodyLimit: 32 * 1024 * 1024 }, async (request, reply) => {
    try {
      const asset = await persistAsset(request, request.body || {});
      return {
        success: true,
        data: {
          assetId: asset.id,
          kind: asset.kind,
          mimeType: asset.mimeType,
          size: asset.size,
          fileName: asset.fileName,
          url: asset.publicUrl,
          createdAt: asset.createdAt,
        },
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get('/api/media/:assetFile', async (request, reply) => {
    try {
      const assetFile = request.params && request.params.assetFile;
      const assetId = String(assetFile || '').split('.')[0];
      const asset = getAssetOrThrow(assetId);
      const buffer = await fsp.readFile(asset.absolutePath);
      reply.header('content-type', asset.mimeType);
      reply.header('cache-control', 'public, max-age=600');
      return reply.send(buffer);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.post('/api/generate/image', async (request, reply) => {
    let userId = '';
    let debited = false;
    try {
      userId = requireUserId(request);
      await debitUser(request, userId, GENERATION_CREDIT_COST, 'Image generation');
      debited = true;
      const result = await createImageGeneration(request, request.body || {});
      const account = await ensureCreditAccount(request, userId);
      return {
        success: true,
        data: {
          ...result,
          credits: {
            cost: GENERATION_CREDIT_COST,
            balance: Number(account.balance || 0),
          },
        },
      };
    } catch (error) {
      if (debited && userId) {
        await creditUser(request, userId, GENERATION_CREDIT_COST, 'Refund for failed image generation', 'REFUND').catch(() => {});
      }
      return sendError(reply, error);
    }
  });

  fastify.post('/api/generate/video', async (request, reply) => {
    try {
      const result = await createVideoTask(request, request.body || {});
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  fastify.get('/api/generate/video/:taskId', async (request, reply) => {
    try {
      const result = await getVideoTaskResult(request, request.params.taskId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

module.exports = plugin;

import { authenticateNativeUser } from './auth';
import { getNativePluginConfig, type PluginSettingsEnv } from './plugin-settings';

type Env = PluginSettingsEnv & Pick<Cloudflare.Env, 'ASSETS' | 'CACHE'>;

function json(data: unknown, status = 200): Response {
  return Response.json({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-imager-ai' },
  });
}

function bodyObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function imageData(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return null;
  const comma = value.indexOf(',');
  return comma > 0 ? value.slice(comma + 1) : null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function extractImage(payload: any): { bytes: Uint8Array; contentType: string } | null {
  const item = payload?.output?.find?.((entry: any) => entry?.type === 'image_generation_call') ?? payload?.output?.[0];
  const encoded = item?.result || item?.b64_json || payload?.data?.[0]?.b64_json;
  if (typeof encoded === 'string') return { bytes: base64ToBytes(encoded), contentType: 'image/png' };
  return null;
}

async function generate(request: Request, env: Env, userId: string): Promise<Response> {
  const configured = await getNativePluginConfig(env, 'imager-ai');
  if (!configured?.enabled) return json({ code: 'NOT_CONFIGURED', message: 'Imager AI is not enabled' }, 503);
  const config = configured.config;
  const baseUrl = String(config.baseUrl || '').replace(/\/$/, '');
  const model = String(config.model || 'gpt-image-1');
  const apiKey = String(config.apiKey || '');
  if (!baseUrl || !apiKey) return json({ code: 'NOT_CONFIGURED', message: 'Imager AI credentials are missing' }, 503);
  const input = bodyObject(await request.json().catch(() => ({})));
  const prompt = String(input.prompt || 'Create a polished image.');
  const source = typeof input.sourceImageUrl === 'string' ? input.sourceImageUrl : undefined;
  const content: Array<Record<string, string>> = [{ type: 'input_text', text: prompt }];
  if (source?.startsWith('data:image/')) content.push({ type: 'input_image', image_url: source });
  const upstream = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: [{ role: 'user', content }], tools: [{ type: 'image_generation' }] }),
  });
  const payload: any = await upstream.json().catch(() => null);
  if (!upstream.ok) return json({ code: 'UPSTREAM_ERROR', message: payload?.error?.message || 'Image provider request failed' }, 502);
  const image = extractImage(payload);
  if (!image) return json({ code: 'INVALID_PROVIDER_RESPONSE', message: 'Image provider returned no image' }, 502);
  const key = `uploads/imager-ai/generated/${new Date().toISOString().slice(0, 10)}/${userId}-${crypto.randomUUID()}.png`;
  await env.ASSETS.put(key, image.bytes, { httpMetadata: { contentType: image.contentType } });
  const url = `/${key}`;
  return json({ imageUrl: url, resultImageUrl: url, model });
}

export async function tryNativeImagerAi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v1\/extensions\/plugin\/imager-ai\/api\/(config|generate|studio\/setup-status)$/);
  if (!match) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
  if (match[1] === 'config' || match[1] === 'studio/setup-status') {
    const configured = await getNativePluginConfig(env, 'imager-ai');
    return json({ configured: Boolean(configured?.enabled), imageReady: Boolean(configured?.enabled), plugin: 'imager-ai', capabilities: { imageGeneration: Boolean(configured?.enabled) } });
  }
  if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' }, 405);
  return generate(request, env, user.id);
}

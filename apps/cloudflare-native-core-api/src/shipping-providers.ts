type JsonObject = Record<string, unknown>;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class ShippingProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
    readonly outcomeUnknown = false,
    readonly response?: unknown,
  ) {
    super(message);
    this.name = 'ShippingProviderError';
  }
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function rotateLeft(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}

// MD5 is required by both carrier protocols but is not exposed by WebCrypto.
// This compact implementation operates on bytes and is safe in Workers.
export function md5Hex(value: string): string {
  const input = utf8(value);
  const length = input.length;
  const paddedLength = (((length + 8) >>> 6) + 1) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[length] = 0x80;
  const bitLength = length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true));
    let a = a0; let b = b0; let c = c0; let d = d0;
    for (let index = 0; index < 64; index += 1) {
      let f: number; let wordIndex: number;
      if (index < 16) { f = (b & c) | (~b & d); wordIndex = index; }
      else if (index < 32) { f = (d & b) | (~d & c); wordIndex = (5 * index + 1) % 16; }
      else if (index < 48) { f = b ^ c ^ d; wordIndex = (3 * index + 5) % 16; }
      else { f = c ^ (b | ~d); wordIndex = (7 * index) % 16; }
      const next = d;
      d = c;
      c = b;
      const shift = shifts[Math.floor(index / 16) * 4 + (index % 4)]!;
      b = (b + rotateLeft((a + f + constants[index]! + words[wordIndex]!) | 0, shift)) | 0;
      a = next;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  return [a0, b0, c0, d0].map((word) => [0, 8, 16, 24]
    .map((shift) => ((word >>> shift) & 0xff).toString(16).padStart(2, '0')).join('')).join('');
}

export function signKuaidi100(rawParam: string, timestamp: string, key: string, secret: string): string {
  return md5Hex(`${rawParam}${timestamp}${key}${secret}`).toUpperCase();
}

export function signKuaidi100Query(rawParam: string, key: string, customer: string): string {
  return md5Hex(`${rawParam}${key}${customer}`).toUpperCase();
}

export function signKuaidi100Webhook(rawParam: string, salt: string): string {
  return md5Hex(`${rawParam}${salt}`).toUpperCase();
}

export function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBytes = utf8(left);
  const rightBytes = utf8(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
}

async function responseJson(response: Response, provider: string, mutation: boolean): Promise<JsonObject> {
  const text = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(text); } catch {
    throw new ShippingProviderError(`${provider} returned a non-JSON response`, 'INVALID_PROVIDER_RESPONSE', response.status >= 500, mutation && response.status >= 500, text);
  }
  const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as JsonObject : {};
  if (!response.ok) throw new ShippingProviderError(`${provider} request failed`, `HTTP_${response.status}`, response.status === 429 || response.status >= 500, mutation && response.status >= 500, payload);
  return record;
}

export interface Kuaidi100Config { key: string; secret: string; customer?: string; }

export class Kuaidi100NativeProvider {
  constructor(private readonly config: Kuaidi100Config, private readonly fetchImpl: FetchLike = fetch, private readonly clock = Date.now) {}

  private async signed(url: string, method: string, payload: JsonObject): Promise<JsonObject> {
    const rawParam = JSON.stringify(payload);
    const timestamp = String(this.clock());
    const body = new URLSearchParams({ method, key: this.config.key, t: timestamp, param: rawParam, sign: signKuaidi100(rawParam, timestamp, this.config.key, this.config.secret) });
    try {
      const response = await this.fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const result = await responseJson(response, 'Kuaidi100', true);
      const code = String(result.returnCode ?? result.code ?? result.status ?? '');
      if (!(result.success === true || result.result === true || code === '200')) throw new ShippingProviderError(String(result.message ?? 'Kuaidi100 request failed'), code || 'PROVIDER_ERROR', code.startsWith('5'), false, result);
      return result;
    } catch (error) {
      if (error instanceof ShippingProviderError) throw error;
      throw new ShippingProviderError('Kuaidi100 network request failed', 'NETWORK_ERROR', true, true);
    }
  }

  createLabel(payload: JsonObject): Promise<JsonObject> { return this.signed('https://api.kuaidi100.com/label/order', 'order', payload); }
  createPickup(payload: JsonObject): Promise<JsonObject> { return this.signed('https://poll.kuaidi100.com/order/borderapi.do', 'bOrder', payload); }

  async query(payload: JsonObject): Promise<JsonObject> {
    const rawParam = JSON.stringify(payload);
    const customer = this.config.customer || this.config.key;
    const body = new URLSearchParams({ customer, sign: signKuaidi100Query(rawParam, this.config.key, customer), param: rawParam });
    try {
      return await responseJson(await this.fetchImpl('https://poll.kuaidi100.com/poll/query.do', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }), 'Kuaidi100', false);
    } catch (error) {
      if (error instanceof ShippingProviderError) throw error;
      throw new ShippingProviderError('Kuaidi100 network request failed', 'NETWORK_ERROR', true, false);
    }
  }

  async subscribe(payload: JsonObject): Promise<JsonObject> {
    const rawParam = JSON.stringify({ ...payload, key: this.config.key });
    const body = new URLSearchParams({ schema: 'json', param: rawParam });
    try {
      return await responseJson(await this.fetchImpl('https://poll.kuaidi100.com/poll', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }), 'Kuaidi100', false);
    } catch (error) {
      if (error instanceof ShippingProviderError) throw error;
      throw new ShippingProviderError('Kuaidi100 network request failed', 'NETWORK_ERROR', true, false);
    }
  }
}

const FOURPX_METHODS = {
  create: ['ds.xms.order.create', '1.1.0'], get: ['ds.xms.order.get', '1.1.0'],
  cancel: ['ds.xms.order.cancel', '1.0.0'], label: ['ds.xms.label.get', '1.1.0'], tracking: ['tr.order.tracking.get', '1.0.0'],
} as const;

export function signFourPx(input: { appKey: string; appSecret: string; method: string; version: string; timestamp: number; body: string }): string {
  return md5Hex(`app_key${input.appKey}formatjsonmethod${input.method}timestamp${input.timestamp}v${input.version}${input.body}${input.appSecret}`);
}

export class FourPxNativeProvider {
  constructor(private readonly config: { appKey: string; appSecret: string; environment: 'test' | 'live'; accessToken?: string; language?: string }, private readonly fetchImpl: FetchLike = fetch, private readonly clock = Date.now) {}

  private async call(operation: keyof typeof FOURPX_METHODS, payload: JsonObject): Promise<JsonObject> {
    const [method, version] = FOURPX_METHODS[operation];
    const body = JSON.stringify(payload);
    const timestamp = Math.trunc(this.clock());
    const query = new URLSearchParams({ method, app_key: this.config.appKey, v: version, timestamp: String(timestamp), format: 'json', sign: signFourPx({ appKey: this.config.appKey, appSecret: this.config.appSecret, method, version, timestamp, body }) });
    if (this.config.accessToken) query.set('access_token', this.config.accessToken);
    if (this.config.language) query.set('language', this.config.language);
    const endpoint = this.config.environment === 'test' ? 'https://open-test.4px.com/router/api/service' : 'https://open.4px.com/router/api/service';
    try {
      const result = await responseJson(await this.fetchImpl(`${endpoint}?${query}`, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body }), '4PX', operation === 'create' || operation === 'cancel');
      if (result.result !== '1' && result.result !== 1 && result.success !== true) {
        const errors = Array.isArray(result.errors) ? result.errors : [];
        const first = errors[0] && typeof errors[0] === 'object' ? errors[0] as JsonObject : {};
        throw new ShippingProviderError(String(first.error_msg ?? result.msg ?? '4PX request failed'), String(first.error_code ?? result.result ?? 'PROVIDER_ERROR'), String(first.error_code) === 'DS000006', false, result);
      }
      return result;
    } catch (error) {
      if (error instanceof ShippingProviderError) throw error;
      throw new ShippingProviderError('4PX network request failed', 'NETWORK_ERROR', true, operation === 'create' || operation === 'cancel');
    }
  }

  create(payload: JsonObject): Promise<JsonObject> { return this.call('create', payload); }
  get(payload: JsonObject): Promise<JsonObject> { return this.call('get', payload); }
  cancel(payload: JsonObject): Promise<JsonObject> { return this.call('cancel', payload); }
  label(payload: JsonObject): Promise<JsonObject> { return this.call('label', payload); }
  tracking(payload: JsonObject): Promise<JsonObject> { return this.call('tracking', payload); }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

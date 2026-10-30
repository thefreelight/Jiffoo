import 'server-only';
import { cookies } from 'next/headers';
import { shopApiHeaders } from './api-headers';
import { ACCESS_COOKIE } from './auth-contract';
import { classifyAvailability } from './availability';

/** The default deadline of the headers of the Core. */
const DEFAULT_EDGE_TIMEOUT_MS = 30000;
/** The default deadline of the body of the Core, which is longer than the deadline of the headers. */
const DEFAULT_EDGE_BODY_TIMEOUT_MS = 300000;
/** The default limit of the response body of the Core that the edge buffers. */
const DEFAULT_MAX_RESPONSE_BYTES = 16777216;

/** The event of every degradation of the edge, so the records can be aggregated. */
const EDGE_DEGRADED_EVENT = 'edge_core_degraded';

/**
 * A positive integer of the environment, or the fallback.
 *
 * A value that is not a positive integer falls back, so a mistyped variable
 * cannot remove the limit or the deadline of the edge.
 */
function positiveInteger(value: string | undefined, fallback: number): number {
  const raw = (value ?? '').trim();
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** The deadline of the headers of the Core. */
function edgeTimeoutMs(): number {
  return positiveInteger(process.env.CORE_EDGE_TIMEOUT_MS, DEFAULT_EDGE_TIMEOUT_MS);
}

/** The deadline of the body of the Core. */
function edgeBodyTimeoutMs(): number {
  return positiveInteger(process.env.CORE_EDGE_BODY_TIMEOUT_MS, DEFAULT_EDGE_BODY_TIMEOUT_MS);
}

/** The limit of the response body of the Core that the edge buffers. */
function maxResponseBytes(): number {
  return positiveInteger(process.env.CORE_EDGE_MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES);
}

/**
 * The record of a degradation of the edge.
 *
 * Every degradation of the edge writes one structured record with the same
 * event, so the operator can aggregate the degradations of the Admin and the
 * Shop by their event, their surface and their reason.
 */
function logEdgeDegraded(record: {
  surface: string;
  reason: string;
  path: string;
  headerDeadlineMs: number;
  bodyDeadlineMs: number;
  upstreamStatus: number | null;
  elapsedMs: number;
}): void {
  console.error(JSON.stringify({ event: EDGE_DEGRADED_EVENT, ...record }));
}

/** The Core did not answer within the deadline of the edge. */
class EdgeTimeoutError extends Error {
  constructor(readonly reason: 'header_timeout' | 'body_timeout' | 'core_error', message: string) { super(message); }
}

/** The response body of the Core exceeded the limit of the edge. */
class CoreResponseTooLargeError extends Error {}

/**
 * Arm the deadlines of an exchange with the Core.
 *
 * The exchange has two phases with two deadlines: the headers of the answer
 * must arrive within the deadline of the headers, and the body of the answer
 * must arrive within the longer deadline of the body. A legitimate large
 * answer therefore survives the deadline of the headers, and a body that
 * stalls is cut at the deadline of the body instead of at the deadline of the
 * headers.
 */
type EdgeDeadline = {
  /** The signal that reaches the request of the Core and the body of its answer. */
  signal: AbortSignal;
  /** The failure of the deadline of the headers. */
  headerFailure: Promise<never>;
  /** Whether the deadline of the headers passed. */
  headerExpired: () => boolean;
  /** The failure of the deadline of the body. */
  bodyFailure: Promise<never>;
  /** Whether the deadline of the body passed. */
  bodyExpired: () => boolean;
  /** The end of the phase of the headers, which hands the exchange to the body. */
  endHeader: () => void;
  /** The end of the exchange, which disarms both deadlines. */
  release: () => void;
};

function createEdgeDeadline(headerMs: number, bodyMs: number): EdgeDeadline {
  const controller = new AbortController();
  let headerExpired = false;
  let bodyExpired = false;
  let failHeader: (error: Error) => void = () => {};
  let failBody: (error: Error) => void = () => {};
  const headerFailure = new Promise<never>((_, reject) => { failHeader = reject; });
  const bodyFailure = new Promise<never>((_, reject) => { failBody = reject; });
  headerFailure.catch(() => { /* The caller of the deadline observes the failure. */ });
  bodyFailure.catch(() => { /* The caller of the deadline observes the failure. */ });
  const headerTimer = setTimeout(() => {
    headerExpired = true;
    const error = new EdgeTimeoutError('header_timeout', 'The Core API did not answer the headers within the edge deadline');
    controller.abort(error);
    failHeader(error);
  }, headerMs);
  let bodyTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    signal: controller.signal,
    headerFailure,
    headerExpired: () => headerExpired,
    bodyFailure,
    bodyExpired: () => bodyExpired,
    endHeader: () => {
      clearTimeout(headerTimer);
      bodyTimer = setTimeout(() => {
        bodyExpired = true;
        const error = new EdgeTimeoutError('body_timeout', 'The Core API did not send the body within the edge deadline');
        controller.abort(error);
        failBody(error);
      }, bodyMs);
    },
    release: () => {
      clearTimeout(headerTimer);
      if (bodyTimer) clearTimeout(bodyTimer);
    },
  };
}

/**
 * Read the response body of the Core within a limit.
 *
 * The edge buffers the body of the Core, so the read is bounded: the declared
 * length is checked before the read, and the read itself stops at the limit.
 * A body that exceeds the limit fails with an explicit code instead of a
 * silent truncation, so the memory of the edge process cannot be filled by a
 * single answer of the Core.
 */
async function readBoundedBody(response: Response, limit: number): Promise<ArrayBuffer> {
  const declared = response.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > limit) throw new CoreResponseTooLargeError('The response body of the Core exceeds the limit of the edge');
  }
  const source = response.body;
  if (!source) return new ArrayBuffer(0);
  const reader = source.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        await reader.cancel('The response body of the Core exceeds the limit of the edge');
        throw new CoreResponseTooLargeError('The response body of the Core exceeds the limit of the edge');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

/**
 * The answer of a Core that did not answer in time.
 *
 * The Shop treats a 503 as its availability state, so the timeout reaches the
 * degraded page of the Shop instead of hanging the request.
 */
function unavailableResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code: 'SHOP_TEMPORARILY_UNAVAILABLE', message: 'The shop is temporarily unavailable' } }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '5' } },
  );
}

/**
 * The answer of a Core whose body exceeded the limit of the edge.
 *
 * The failure carries its own code, so the client can tell an oversized
 * answer of the Core from an unavailable Core.
 */
function oversizedResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code: 'CORE_RESPONSE_TOO_LARGE', message: 'The Core response exceeds the limit of the shop' } }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '5' } },
  );
}

/** The statuses that carry no body. */
const nullBodyStatus = new Set([204, 205, 304]);

export async function shopApi(path: string, token?: string, init: RequestInit = {}): Promise<Response> {
  const base = new URL(process.env.API_SERVICE_URL || 'http://127.0.0.1:3001');
  const url = new URL(`/api/v1${path}`, base);
  if (!path.startsWith('/') || path.startsWith('//') || url.origin !== base.origin || !url.pathname.startsWith('/api/v1/')) throw new Error('Invalid internal Core request path');
  const outgoing = await shopApiHeaders(new Headers(init.headers));
  outgoing.delete('Authorization');
  if (token) outgoing.set('Authorization', `Bearer ${token}`);
  const headerDeadlineMs = edgeTimeoutMs();
  const bodyDeadlineMs = edgeBodyTimeoutMs();
  const deadline = createEdgeDeadline(headerDeadlineMs, bodyDeadlineMs);
  const started = Date.now();
  try {
    const upstream = await Promise.race([
      fetch(url, { ...init, headers: outgoing, cache: 'no-store', redirect: 'error', signal: deadline.signal }),
      deadline.headerFailure,
    ]);
    deadline.endHeader();
    // The body of the answer belongs to the exchange: it is read under the
    // deadline of the body and within the limit of the edge, so a Core that
    // answers the headers and then stalls the body cannot hold the request of
    // the Shop open forever.
    const body = await Promise.race([readBoundedBody(upstream, maxResponseBytes()), deadline.bodyFailure]);
    if (upstream.status < 200 || upstream.status > 599) return upstream;
    const headers = new Headers(upstream.headers);
    // The body was decoded, so the encoding and the length of the Core no
    // longer describe the answer that the Shop hands on.
    headers.delete('content-encoding');
    headers.delete('content-length');
    return new Response(nullBodyStatus.has(upstream.status) ? null : body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    const reason = error instanceof CoreResponseTooLargeError
      ? 'response_too_large'
      : deadline.headerExpired() ? 'header_timeout' : deadline.bodyExpired() ? 'body_timeout' : 'core_error';
    logEdgeDegraded({
      surface: 'shop_transport',
      reason,
      path: url.pathname,
      headerDeadlineMs,
      bodyDeadlineMs,
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    if (error instanceof CoreResponseTooLargeError) return oversizedResponse();
    if (deadline.headerExpired() || deadline.bodyExpired()) return unavailableResponse();
    throw error;
  } finally {
    deadline.release();
  }
}

export async function serverCoreResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const response = await shopApi(path, token, init);
  const unavailable = await classifyAvailability(response);
  if (unavailable) throw unavailable;
  return response;
}

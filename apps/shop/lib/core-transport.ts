import 'server-only';
import { cookies } from 'next/headers';
import { shopApiHeaders } from './api-headers';
import { ACCESS_COOKIE } from './auth-contract';
import { classifyAvailability } from './availability';

/** The default deadline of a call from the Shop edge to the Core. */
const DEFAULT_EDGE_TIMEOUT_MS = 30000;

/**
 * The deadline of a call from the Shop edge to the Core.
 *
 * The deadline comes from the environment, and a value that is not a positive
 * integer falls back to the default, so a mistyped variable cannot remove the
 * deadline of the edge.
 */
function edgeTimeoutMs(): number {
  const raw = (process.env.CORE_EDGE_TIMEOUT_MS ?? '').trim();
  if (!/^\d+$/.test(raw)) return DEFAULT_EDGE_TIMEOUT_MS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_EDGE_TIMEOUT_MS;
}

/** The Core did not answer within the deadline of the edge. */
class EdgeTimeoutError extends Error {}

/**
 * Arm the deadline of an exchange with the Core.
 *
 * The deadline covers the whole exchange: the request of the Core, the headers
 * of its answer and the body of that answer. A Core that answers the headers
 * and then stalls the body therefore cannot hold the request of the Shop open,
 * and the caller disarms the deadline when the answer is complete.
 */
type EdgeDeadline = {
  /** The signal that reaches the request of the Core and the body of its answer. */
  signal: AbortSignal;
  /** The failure of the deadline, for the caller that waits for the Core. */
  failure: Promise<never>;
  /** Whether the deadline passed. */
  expired: () => boolean;
  /** The end of the exchange, which disarms the deadline. */
  release: () => void;
};

function armEdgeDeadline(timeoutMs: number): EdgeDeadline {
  const controller = new AbortController();
  let expired = false;
  let fail: (error: Error) => void = () => {};
  const failure = new Promise<never>((_, reject) => { fail = reject; });
  failure.catch(() => { /* The caller of the deadline observes the failure. */ });
  const timer = setTimeout(() => {
    expired = true;
    const error = new EdgeTimeoutError('The Core API did not answer within the edge deadline');
    controller.abort(error);
    fail(error);
  }, timeoutMs);
  return {
    signal: controller.signal,
    failure,
    expired: () => expired,
    release: () => clearTimeout(timer),
  };
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

/** The statuses that carry no body. */
const nullBodyStatus = new Set([204, 205, 304]);

export async function shopApi(path: string, token?: string, init: RequestInit = {}): Promise<Response> {
  const base = new URL(process.env.API_SERVICE_URL || 'http://127.0.0.1:3001');
  const url = new URL(`/api/v1${path}`, base);
  if (!path.startsWith('/') || path.startsWith('//') || url.origin !== base.origin || !url.pathname.startsWith('/api/v1/')) throw new Error('Invalid internal Core request path');
  const outgoing = await shopApiHeaders(new Headers(init.headers));
  outgoing.delete('Authorization');
  if (token) outgoing.set('Authorization', `Bearer ${token}`);
  const deadline = armEdgeDeadline(edgeTimeoutMs());
  try {
    const upstream = await Promise.race([
      fetch(url, { ...init, headers: outgoing, cache: 'no-store', redirect: 'error', signal: deadline.signal }),
      deadline.failure,
    ]);
    // The body of the answer belongs to the exchange: it is read under the
    // same deadline as the headers, so a Core that answers the headers and
    // then stalls the body cannot hold the request of the Shop open forever.
    const body = await Promise.race([upstream.arrayBuffer(), deadline.failure]);
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
    if (deadline.expired()) return unavailableResponse();
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

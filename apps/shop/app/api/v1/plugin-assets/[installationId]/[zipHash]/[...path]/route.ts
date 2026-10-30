import type { NextRequest } from 'next/server';

const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

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
 * and then stalls the body therefore cannot hold the request of the browser
 * open, and the caller disarms the deadline when the answer is complete.
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
 * Stream the body of the Core under the deadline.
 *
 * The deadline stays armed until the stream ends: a Core that stalls the body
 * aborts the stream, and the client receives a truncated answer instead of a
 * request that never ends. The deadline is disarmed when the stream is done,
 * so an abort after the answer never reaches a finished exchange.
 */
function deadlineBody(source: ReadableStream<Uint8Array> | null, deadline: EdgeDeadline): ReadableStream<Uint8Array> | null {
  if (!source) {
    deadline.release();
    return null;
  }
  const reader = source.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          deadline.release();
          controller.close();
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        deadline.release();
        controller.error(error);
      }
    },
    cancel(reason) {
      deadline.release();
      void reader.cancel(reason);
    },
  });
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
 * fetch() cannot send a Host header, so the public host travels as x-forwarded-host.
 * Next.js records the incoming host there, and the request URL is the last resort.
 */
function incomingHost(request: NextRequest): string {
  return request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
}

/** Stateless local asset transport mirrors the deployment edge without forwarding identity. */
async function readAsset(request: NextRequest): Promise<Response> {
  if (!process.env.API_SERVICE_URL) return new Response(null, { status: 503 });
  const incoming = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const header of [...hopByHop, 'host', 'content-length', 'cookie', 'authorization']) headers.delete(header);
  headers.delete('x-forwarded-host');
  if (process.env.STOREFRONT_URL) {
    try {
      const configured = new URL(process.env.STOREFRONT_URL);
      if (incomingHost(request) === configured.host) headers.set('x-forwarded-host', configured.host);
    } catch { /* The API refuses HTML without valid public-origin configuration. */ }
  }
  const deadline = armEdgeDeadline(edgeTimeoutMs());
  let upstream: Response;
  try {
    upstream = await Promise.race([
      fetch(new URL(`${incoming.pathname}${incoming.search}`, process.env.API_SERVICE_URL), {
        method: request.method, headers, redirect: 'manual', cache: 'no-store', signal: deadline.signal,
      }),
      deadline.failure,
    ]);
  } catch (error) {
    deadline.release();
    if (deadline.expired()) return unavailableResponse();
    throw error;
  }
  const outgoing = new Headers(upstream.headers);
  for (const header of [...hopByHop, 'set-cookie', 'access-control-allow-credentials']) outgoing.delete(header);
  return new Response(deadlineBody(upstream.body, deadline), { status: upstream.status, headers: outgoing });
}

export const dynamic = 'force-dynamic';
export const GET = readAsset;
export const HEAD = readAsset;

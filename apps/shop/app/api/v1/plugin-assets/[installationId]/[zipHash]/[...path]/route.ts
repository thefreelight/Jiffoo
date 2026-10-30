import type { NextRequest } from 'next/server';

const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

/** The default deadline of the headers of the Core. */
const DEFAULT_EDGE_TIMEOUT_MS = 30000;
/** The default deadline of the body of the Core, which is longer than the deadline of the headers. */
const DEFAULT_EDGE_BODY_TIMEOUT_MS = 300000;

/** The event of every degradation of the edge, so the records can be aggregated. */
const EDGE_DEGRADED_EVENT = 'edge_core_degraded';

/**
 * A positive integer of the environment, or the fallback.
 *
 * A value that is not a positive integer falls back, so a mistyped variable
 * cannot remove the deadline of the edge.
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
class EdgeTimeoutError extends Error {}

/**
 * Arm the deadlines of an exchange with the Core.
 *
 * The exchange has two phases with two deadlines: the headers of the answer
 * must arrive within the deadline of the headers, and the body of the answer
 * must arrive within the longer deadline of the body. A legitimate large
 * asset therefore survives the deadline of the headers, and a body that
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
    const error = new EdgeTimeoutError('The Core API did not answer the headers within the edge deadline');
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
        const error = new EdgeTimeoutError('The Core API did not send the body within the edge deadline');
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
 * Stream the body of the Core under the deadline of the body.
 *
 * The deadline stays armed until the stream ends: a Core that stalls the body
 * aborts the stream, and the client receives a failed and truncated answer
 * instead of a request that never ends. The stream is never closed cleanly
 * after a truncation, and the length of the Core is kept in the answer, so
 * the client can tell a truncated answer from a complete one.
 */
function deadlineBody(
  source: ReadableStream<Uint8Array> | null,
  deadline: EdgeDeadline,
  context: { path: string; headerDeadlineMs: number; bodyDeadlineMs: number; started: number; upstreamStatus: number },
): ReadableStream<Uint8Array> | null {
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
        logEdgeDegraded({
          surface: 'shop_asset',
          reason: deadline.bodyExpired() ? 'body_timeout' : 'body_error',
          path: context.path,
          headerDeadlineMs: context.headerDeadlineMs,
          bodyDeadlineMs: context.bodyDeadlineMs,
          upstreamStatus: context.upstreamStatus,
          elapsedMs: Date.now() - context.started,
        });
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
  const started = Date.now();
  const headerDeadlineMs = edgeTimeoutMs();
  const bodyDeadlineMs = edgeBodyTimeoutMs();
  const incoming = new URL(request.url);
  if (!process.env.API_SERVICE_URL) {
    logEdgeDegraded({
      surface: 'shop_asset',
      reason: 'core_not_configured',
      path: incoming.pathname,
      headerDeadlineMs,
      bodyDeadlineMs,
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    return new Response(null, { status: 503 });
  }
  const headers = new Headers(request.headers);
  for (const header of [...hopByHop, 'host', 'content-length', 'cookie', 'authorization']) headers.delete(header);
  headers.delete('x-forwarded-host');
  if (process.env.STOREFRONT_URL) {
    try {
      const configured = new URL(process.env.STOREFRONT_URL);
      if (incomingHost(request) === configured.host) headers.set('x-forwarded-host', configured.host);
    } catch {
      logEdgeDegraded({
        surface: 'shop_asset',
        reason: 'origin_configuration_invalid',
        path: incoming.pathname,
        headerDeadlineMs,
        bodyDeadlineMs,
        upstreamStatus: null,
        elapsedMs: Date.now() - started,
      });
    }
  }
  const deadline = createEdgeDeadline(headerDeadlineMs, bodyDeadlineMs);
  let upstream: Response;
  try {
    upstream = await Promise.race([
      fetch(new URL(`${incoming.pathname}${incoming.search}`, process.env.API_SERVICE_URL), {
        method: request.method, headers, redirect: 'manual', cache: 'no-store', signal: deadline.signal,
      }),
      deadline.headerFailure,
    ]);
  } catch (error) {
    deadline.release();
    const reason = deadline.headerExpired() ? 'header_timeout' : 'core_error';
    logEdgeDegraded({
      surface: 'shop_asset',
      reason,
      path: incoming.pathname,
      headerDeadlineMs,
      bodyDeadlineMs,
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    });
    if (deadline.headerExpired()) return unavailableResponse();
    throw error;
  }
  deadline.endHeader();

  const outgoing = new Headers(upstream.headers);
  for (const header of [...hopByHop, 'set-cookie', 'access-control-allow-credentials']) outgoing.delete(header);
  return new Response(deadlineBody(upstream.body, deadline, {
    path: incoming.pathname,
    headerDeadlineMs,
    bodyDeadlineMs,
    started,
    upstreamStatus: upstream.status,
  }), { status: upstream.status, headers: outgoing });
}

export const dynamic = 'force-dynamic';
export const GET = readAsset;
export const HEAD = readAsset;

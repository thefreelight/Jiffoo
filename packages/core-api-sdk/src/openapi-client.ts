import createClient from 'openapi-fetch';
import type { paths } from './openapi-types';
import { CoreApiError } from './errors';
import type { CoreApiEnvelope } from './types';
import { getRequestId, isJsonContentType, joinUrl } from './utils';

export type CoreApiTokenProvider =
  | string
  | null
  | undefined
  | (() => string | null | undefined | Promise<string | null | undefined>);

export type CoreApiRequestIdProvider =
  | string
  | null
  | undefined
  | (() => string | null | undefined | Promise<string | null | undefined>);

export type CoreOpenApiClientOptions = {
  baseUrl?: string;
  token?: CoreApiTokenProvider;
  requestId?: CoreApiRequestIdProvider;
  requestIdHeaderName?: string;
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
};

type OpenApiClientBase = ReturnType<typeof createClient<paths>>;
export type CoreOpenApiClient = OpenApiClientBase & {
  call<T = unknown>(path: string, init?: RequestInit): Promise<T>;
};

async function resolveToken(token: CoreApiTokenProvider) {
  if (typeof token === 'function') return token();
  return token;
}

async function resolveRequestId(requestId: CoreApiRequestIdProvider) {
  if (typeof requestId === 'function') return requestId();
  return requestId;
}

async function resolveHeaders(
  headers: CoreOpenApiClientOptions['headers']
): Promise<HeadersInit | undefined> {
  if (!headers) return undefined;
  if (typeof headers === 'function') return headers();
  return headers;
}

/**
 * Shape of a non-envelope JSON error body (HTTP 4xx/5xx responses
 * that do not use the CoreApiEnvelope format).
 */
type ErrorResponseBody = {
  success?: false;
  error?:
    | {
        code?: string;
        message?: string;
        details?: unknown;
      }
    | string;
  message?: string;
};

/**
 * Typed OpenAPI client for Core API endpoints.
 */
export function createCoreOpenApiClient(
  options: CoreOpenApiClientOptions = {}
): CoreOpenApiClient {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetch ?? fetch;
  const defaultCredentials = options.credentials ?? 'include';
  const requestIdHeaderName = options.requestIdHeaderName ?? 'x-request-id';

  async function buildHeaders(initHeaders?: HeadersInit) {
    const mergedHeaders = new Headers(initHeaders);
    const extraHeaders = await resolveHeaders(options.headers);
    if (extraHeaders) {
      new Headers(extraHeaders).forEach((value, key) => mergedHeaders.set(key, value));
    }

    const token = await resolveToken(options.token);
    if (token && !mergedHeaders.has('Authorization')) {
      mergedHeaders.set('Authorization', `Bearer ${token}`);
    }

    const requestId = await resolveRequestId(options.requestId);
    if (requestId && !mergedHeaders.has(requestIdHeaderName)) {
      mergedHeaders.set(requestIdHeaderName, requestId);
    }
    return mergedHeaders;
  }

  const openapi = createClient<paths>({
    baseUrl,
    fetch: async (input, init: RequestInit = {}) => {
      const headers = await buildHeaders(init.headers);
      // openapi-fetch passes a URL object internally; cast to satisfy the global fetch overload.
      return fetchImpl(input as unknown as Parameters<typeof fetch>[0], {
        ...init,
        headers,
        credentials: init.credentials ?? defaultCredentials,
      });
    },
  });

  async function call<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const url = joinUrl(baseUrl, path);
    const headers = await buildHeaders(init.headers);

    const response = await fetchImpl(url, {
      ...init,
      headers,
      credentials: init.credentials ?? defaultCredentials,
    });

    const requestId = getRequestId(response.headers);
    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      if (isJsonContentType(contentType)) {
        const errBody = (await response.json().catch(() => null)) as ErrorResponseBody | null;
        const errObj = typeof errBody?.error === 'object' ? errBody.error : undefined;
        if (errObj?.code && errObj.message) {
          throw new CoreApiError({
            status: response.status,
            code: errObj.code,
            message: errObj.message,
            details: errObj.details,
            requestId,
          });
        }
        const fallbackMsg =
          typeof errBody?.error === 'string'
            ? errBody.error
            : (errBody?.message ?? `HTTP ${response.status}`);
        throw new CoreApiError({
          status: response.status,
          code: 'HTTP_ERROR',
          message: fallbackMsg,
          details: errBody ?? undefined,
          requestId,
        });
      }

      const text = await response.text().catch(() => '');
      throw new CoreApiError({
        status: response.status,
        code: 'HTTP_ERROR',
        message: text || `HTTP ${response.status}`,
        details: text || undefined,
        requestId,
      });
    }

    if (!isJsonContentType(contentType)) {
      // Generic escape hatch: the caller declared T but the body is plain text.
      // There is no way to satisfy this without a cast because T is opaque here.
      return (await response.text()) as unknown as T;
    }

    const json = (await response.json()) as CoreApiEnvelope<T>;

    if (json.success) {
      // Narrowed to CoreApiSuccessEnvelope<T> — .data is T.
      return json.data;
    }

    // Narrowed to CoreApiErrorEnvelope — all fields are typed, no cast needed.
    throw new CoreApiError({
      status: response.status,
      code: json.error.code,
      message: json.error.message,
      details: json.error.details,
      requestId,
    });
  }

  return Object.assign(openapi, { call }) as CoreOpenApiClient;
}

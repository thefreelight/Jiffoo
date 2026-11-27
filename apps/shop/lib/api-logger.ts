/**
 * API Logger Interceptor
 */

import { logger } from './logger';

export interface ApiLogData {
  url: string;
  method: string;
  status?: number;
  duration?: number;
  error?: any;
  requestData?: any;
  responseData?: any;
}

/**
 * Log API call details
 */
export function logApiCall(data: ApiLogData) {
  const { url, method, status, duration, error, requestData, responseData } = data;

  const logLevel = error || (status && status >= 400) ? 'warn' : 'info';
  const message = error ? 'API Call Failed' : 'API Call';

  logger[logLevel](message, {
    type: 'api_call',
    url,
    method: method.toUpperCase(),
    status,
    duration,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined,
    requestSize: requestData ? JSON.stringify(requestData).length : undefined,
    responseSize: responseData ? JSON.stringify(responseData).length : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * What a request carried, for the log: a JSON body as it was parsed; anything else only described — a form's
 * field and file names, a blob's size and type, a body's length. Never the contents. Before this, every body was
 * read as JSON, so a form upload (a screenshot sent with an application, a picture with a review) reached the
 * server and was then reported to the page as failed.
 */
export function describeRequestBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body.slice(0, 500);
    }
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return {
      form: [...body.entries()].map(([name, value]) => (
        typeof File !== 'undefined' && value instanceof File ? { name, file: value.name, size: value.size, type: value.type } : { name }
      )),
    };
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return Object.fromEntries(body);
  if (typeof Blob !== 'undefined' && body instanceof Blob) return { blob: { size: body.size, type: body.type } };
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return { bytes: body.byteLength };
  return { stream: true };
}

/**
 * Page-view beacons are telemetry themselves: logging every one would add a
 * record per page view to the log (and, with remote logs on, to every batch)
 * and say nothing an API log is for.
 */
const TRAFFIC_BEACON_PATH = '/v1/traffic/collect';

/**
 * Create API interceptor
 */
export function createApiInterceptor() {
  // Intercept fetch requests
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = Date.now();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || 'GET';

    if (url.includes(TRAFFIC_BEACON_PATH)) return originalFetch(input, init);

    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;

      // Log successful API call
      logApiCall({
        url,
        method,
        status: response.status,
        duration,
        requestData: describeRequestBody(init?.body)
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed API call
      logApiCall({
        url,
        method,
        duration,
        error,
        requestData: describeRequestBody(init?.body)
      });

      throw error;
    }
  };
}

/**
 * Restore original fetch function
 */
export function restoreOriginalFetch() {
  // Here we could restore saved fetch reference
  // Simplified for now
}

/**
 * Create interceptor for axios or other HTTP clients
 */
export function setupAxiosInterceptors(axiosInstance: any) {
  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config: any) => {
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error: any) => {
      logApiCall({
        url: error.config?.url || 'unknown',
        method: error.config?.method || 'unknown',
        error
      });
      return Promise.reject(error);
    }
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    (response: any) => {
      const duration = Date.now() - response.config.metadata.startTime;

      logApiCall({
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        duration,
        requestData: response.config.data,
        responseData: response.data
      });

      return response;
    },
    (error: any) => {
      const duration = error.config?.metadata ?
        Date.now() - error.config.metadata.startTime :
        undefined;

      logApiCall({
        url: error.config?.url || 'unknown',
        method: error.config?.method || 'unknown',
        status: error.response?.status,
        duration,
        error,
        requestData: error.config?.data,
        responseData: error.response?.data
      });

      return Promise.reject(error);
    }
  );
}

export default {
  logApiCall,
  createApiInterceptor,
  setupAxiosInterceptors
};
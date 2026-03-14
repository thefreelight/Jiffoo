import {
  createCoreOpenApiClient,
  type CoreApiTokenProvider,
} from '@jiffoo/core-api-sdk';
import type { ThemeApiClientOptions, RequestOptions, PluginInvokeOptions } from './types';
import { buildPathWithQuery, normalizePrefix, resolveApiPath, shouldUseJsonBody } from './utils';

type CoreOpenApiClient = ReturnType<typeof createCoreOpenApiClient>;

export type ThemeApiClient = {
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  openapi: CoreOpenApiClient;
  auth: {
    login<T = unknown>(payload: unknown): Promise<T>;
    register<T = unknown>(payload: unknown): Promise<T>;
    me<T = unknown>(): Promise<T>;
    refresh<T = unknown>(payload: { refresh_token: string }): Promise<T>;
    logout<T = unknown>(): Promise<T>;
    changePassword<T = unknown>(payload: { currentPassword: string; newPassword: string }): Promise<T>;
  };
  account: {
    getProfile<T = unknown>(): Promise<T>;
    updateProfile<T = unknown>(payload: Record<string, unknown>): Promise<T>;
    uploadAvatar<T = unknown>(formData: FormData): Promise<T>;
  };
  products: {
    list<T = unknown>(query?: Record<string, unknown>): Promise<T>;
    detail<T = unknown>(id: string, query?: Record<string, unknown>): Promise<T>;
    categories<T = unknown>(query?: Record<string, unknown>): Promise<T>;
    search<T = unknown>(query: { q: string; page?: number; limit?: number; locale?: string }): Promise<T>;
  };
  cart: {
    get<T = unknown>(): Promise<T>;
    add<T = unknown>(payload: { productId: string; quantity: number; variantId?: string }): Promise<T>;
    updateItem<T = unknown>(itemId: string, payload: { quantity: number }): Promise<T>;
    removeItem<T = unknown>(itemId: string): Promise<T>;
    clear<T = unknown>(): Promise<T>;
  };
  orders: {
    list<T = unknown>(query?: Record<string, unknown>): Promise<T>;
    detail<T = unknown>(id: string): Promise<T>;
    create<T = unknown>(payload: unknown): Promise<T>;
    cancel<T = unknown>(id: string, payload: { cancelReason: string }): Promise<T>;
  };
  payments: {
    availableMethods<T = unknown>(): Promise<T>;
    createSession<T = unknown>(payload: unknown): Promise<T>;
    verifySession<T = unknown>(sessionId: string): Promise<T>;
  };
  store: {
    context<T = unknown>(query?: { domain?: string; slug?: string }): Promise<T>;
  };
  themes: {
    active<T = unknown>(query?: { target?: 'shop' | 'admin' }): Promise<T>;
    installed<T = unknown>(query?: { page?: number; limit?: number }): Promise<T>;
  };
  plugins: {
    invoke<T = unknown>(slug: string, pluginPath: string, options?: PluginInvokeOptions): Promise<T>;
  };
};

function toCoreTokenProvider(
  token?: ThemeApiClientOptions['token']
): CoreApiTokenProvider {
  return token as CoreApiTokenProvider;
}

function buildRequestInit(options?: RequestOptions): RequestInit {
  const method = options?.method || 'GET';
  const headers = new Headers(options?.headers);
  const init: RequestInit = { method, headers };

  if (options?.body !== undefined) {
    if (shouldUseJsonBody(options.body)) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      init.body = JSON.stringify(options.body);
    } else {
      init.body = options.body as BodyInit;
    }
  }

  return init;
}

export function createThemeApiClient(options: ThemeApiClientOptions = {}): ThemeApiClient {
  const apiPrefix = normalizePrefix(options.apiPrefix ?? '/api');
  const openapi = createCoreOpenApiClient({
    baseUrl: options.baseUrl ?? '',
    token: toCoreTokenProvider(options.token),
    credentials: options.credentials ?? 'include',
    fetch: options.fetch,
    headers: options.headers,
  });

  async function request<T = unknown>(path: string, optionsIn?: RequestOptions): Promise<T> {
    const resolvedPath = resolveApiPath(apiPrefix, path);
    const pathWithQuery = buildPathWithQuery(resolvedPath, optionsIn?.query);
    return openapi.call<T>(pathWithQuery, buildRequestInit(optionsIn));
  }

  return {
    request,
    openapi,
    auth: {
      login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
      register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
      me: () => request('/auth/me'),
      refresh: (payload) => request('/auth/refresh', { method: 'POST', body: payload }),
      logout: () => request('/auth/logout', { method: 'POST' }),
      changePassword: (payload) => request('/auth/change-password', { method: 'POST', body: payload }),
    },
    account: {
      getProfile: () => request('/account/profile'),
      updateProfile: (payload) => request('/account/profile', { method: 'PUT', body: payload }),
      uploadAvatar: (formData) => request('/account/avatar', { method: 'POST', body: formData }),
    },
    products: {
      list: (query) => request('/products', { query }),
      detail: (id, query) => request(`/products/${id}`, { query }),
      categories: (query) => request('/products/categories', { query }),
      search: (query) => request('/products/search', { query }),
    },
    cart: {
      get: () => request('/cart'),
      add: (payload) => request('/cart/items', { method: 'POST', body: payload }),
      updateItem: (itemId, payload) =>
        request(`/cart/items/${itemId}`, { method: 'PUT', body: payload }),
      removeItem: (itemId) => request(`/cart/items/${itemId}`, { method: 'DELETE' }),
      clear: () => request('/cart', { method: 'DELETE' }),
    },
    orders: {
      list: (query) => request('/orders', { query }),
      detail: (id) => request(`/orders/${id}`),
      create: (payload) => request('/orders', { method: 'POST', body: payload }),
      cancel: (id, payload) => request(`/orders/${id}/cancel`, { method: 'POST', body: payload }),
    },
    payments: {
      availableMethods: () => request('/payments/available-methods'),
      createSession: (payload) => request('/payments/create-session', { method: 'POST', body: payload }),
      verifySession: (sessionId) => request(`/payments/verify/${sessionId}`),
    },
    store: {
      context: (query) => request('/store/context', { query }),
    },
    themes: {
      active: (query) => request('/themes/active', { query }),
      installed: (query) => request('/themes/installed', { query }),
    },
    plugins: {
      invoke: (slug, pluginPath, optionsInvoke) => {
        const safePath = pluginPath.startsWith('/') ? pluginPath : `/${pluginPath}`;
        const path = `/extensions/plugin/${slug}/api${safePath}`;
        const query = {
          ...(optionsInvoke?.query || {}),
          ...(optionsInvoke?.installation ? { installation: optionsInvoke.installation } : {}),
          ...(optionsInvoke?.installationId ? { installationId: optionsInvoke.installationId } : {}),
        };
        return request(path, {
          method: optionsInvoke?.method || 'GET',
          query,
          body: optionsInvoke?.body,
          headers: optionsInvoke?.headers,
        });
      },
    },
  };
}

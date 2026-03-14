export type PageResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ThemeApiTokenProvider =
  | string
  | null
  | undefined
  | (() => string | null | undefined | Promise<string | null | undefined>);

export type ThemeApiClientOptions = {
  /**
   * Core API base URL.
   * Default: '' (browser-relative)
   */
  baseUrl?: string;
  /**
   * API prefix that is prepended to endpoint paths.
   * Default: '/api'
   */
  apiPrefix?: string;
  /**
   * JWT token or provider.
   */
  token?: ThemeApiTokenProvider;
  /**
   * Fetch credentials mode.
   * Default: 'include'
   */
  credentials?: RequestCredentials;
  /**
   * Custom fetch implementation for SSR/tests.
   */
  fetch?: typeof fetch;
  /**
   * Extra headers hook.
   */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
};

export type RequestOptions = {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: HeadersInit;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
};

export type PluginInvokeOptions = RequestOptions & {
  installation?: string;
  installationId?: string;
};

/**
 * Jiffoo Plugin SDK - Sandboxed Database & Storage
 *
 * Provides isolated database and storage access for plugins.
 * Each plugin gets its own namespace to prevent data conflicts.
 */

import type { PluginContext } from './types';

/**
 * Plugin database interface (sandboxed)
 */
export interface PluginDatabase {
  /**
   * Get a value by key
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set a value by key
   */
  set<T = unknown>(key: string, value: T, options?: { ttl?: number }): Promise<void>;

  /**
   * Delete a value by key
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * List all keys with optional prefix
   */
  keys(prefix?: string): Promise<string[]>;

  /**
   * Clear all data for this plugin
   */
  clear(): Promise<void>;

  /**
   * Get multiple values by keys
   */
  getMany<T = unknown>(keys: string[]): Promise<Map<string, T | null>>;

  /**
   * Set multiple values
   */
  setMany<T = unknown>(entries: Array<[string, T]>): Promise<void>;
}

/**
 * Plugin storage interface (sandboxed file storage)
 */
export interface PluginStorage {
  /**
   * Upload a file
   */
  upload(
    filename: string,
    content: Buffer | string,
    options?: { contentType?: string; public?: boolean }
  ): Promise<{ url: string; key: string }>;

  /**
   * Download a file
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file
   */
  delete(key: string): Promise<boolean>;

  /**
   * List files with optional prefix
   */
  list(prefix?: string): Promise<Array<{ key: string; size: number; lastModified: Date }>>;

  /**
   * Get a signed URL for temporary access
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;
}

/**
 * Create a sandboxed database instance for a plugin
 *
 * @param context - Plugin context
 * @param apiBaseUrl - Platform API base URL
 * @returns Sandboxed database instance
 *
 * @example
 * ```typescript
 * const db = createPluginDatabase(context, 'https://api.jiffoo.com');
 *
 * // Store data
 * await db.set('user:123', { name: 'John', email: 'john@example.com' });
 *
 * // Retrieve data
 * const user = await db.get('user:123');
 * ```
 */
export function createPluginDatabase(
  context: PluginContext,
  apiBaseUrl: string = process.env.JIFFOO_API_URL || 'http://localhost:3000'
): PluginDatabase {
  const namespace = `plugin:${context.pluginSlug}:${context.installationId}`;

  const makeRequest = async (
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<unknown> => {
    const url = `${apiBaseUrl}/api/plugins/storage${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Plugin-Slug': context.pluginSlug,
        'X-Installation-Id': context.installationId,
        'X-Platform-Signature': context.signature,
        'X-Platform-Timestamp': context.timestamp,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
      throw new Error(`Database error: ${error.message || response.statusText}`);
    }

    return response.json();
  };

  return {
    async get<T>(key: string): Promise<T | null> {
      const result = await makeRequest('GET', `/kv/${encodeURIComponent(`${namespace}:${key}`)}`);
      return (result as { value: T | null }).value;
    },

    async set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
      await makeRequest('PUT', `/kv/${encodeURIComponent(`${namespace}:${key}`)}`, {
        value,
        ttl: options?.ttl,
      });
    },

    async delete(key: string): Promise<boolean> {
      const result = await makeRequest('DELETE', `/kv/${encodeURIComponent(`${namespace}:${key}`)}`);
      return (result as { deleted: boolean }).deleted;
    },

    async has(key: string): Promise<boolean> {
      const result = await makeRequest('HEAD', `/kv/${encodeURIComponent(`${namespace}:${key}`)}`);
      return (result as { exists: boolean }).exists;
    },

    async keys(prefix?: string): Promise<string[]> {
      const fullPrefix = prefix ? `${namespace}:${prefix}` : namespace;
      const result = await makeRequest('GET', `/kv?prefix=${encodeURIComponent(fullPrefix)}`);
      const keys = (result as { keys: string[] }).keys;
      // Remove namespace prefix from returned keys
      return keys.map(k => k.replace(`${namespace}:`, ''));
    },

    async clear(): Promise<void> {
      await makeRequest('DELETE', `/kv?prefix=${encodeURIComponent(namespace)}`);
    },

    async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
      const fullKeys = keys.map(k => `${namespace}:${k}`);
      const result = await makeRequest('POST', '/kv/batch/get', { keys: fullKeys });
      const values = (result as { values: Record<string, T | null> }).values;

      const map = new Map<string, T | null>();
      for (const key of keys) {
        map.set(key, values[`${namespace}:${key}`] ?? null);
      }
      return map;
    },

    async setMany<T>(entries: Array<[string, T]>): Promise<void> {
      const fullEntries = entries.map(([k, v]) => [`${namespace}:${k}`, v]);
      await makeRequest('POST', '/kv/batch/set', { entries: fullEntries });
    },
  };
}

/**
 * Create a sandboxed storage instance for a plugin
 *
 * @param context - Plugin context
 * @param apiBaseUrl - Platform API base URL
 * @returns Sandboxed storage instance
 *
 * @example
 * ```typescript
 * const storage = createPluginStorage(context, 'https://api.jiffoo.com');
 *
 * // Upload a file
 * const { url } = await storage.upload('report.pdf', pdfBuffer, {
 *   contentType: 'application/pdf',
 *   public: false,
 * });
 *
 * // Get signed URL for download
 * const downloadUrl = await storage.getSignedUrl('report.pdf', 3600);
 * ```
 */
export function createPluginStorage(
  context: PluginContext,
  apiBaseUrl: string = process.env.JIFFOO_API_URL || 'http://localhost:3000'
): PluginStorage {
  const namespace = `plugins/${context.pluginSlug}/${context.installationId}`;

  const makeRequest = async (
    method: string,
    endpoint: string,
    body?: unknown,
    isFormData = false
  ): Promise<unknown> => {
    const url = `${apiBaseUrl}/api/plugins/files${endpoint}`;
    const headers: Record<string, string> = {
      'X-Plugin-Slug': context.pluginSlug,
      'X-Installation-Id': context.installationId,
      'X-Platform-Signature': context.signature,
      'X-Platform-Timestamp': context.timestamp,
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
      throw new Error(`Storage error: ${error.message || response.statusText}`);
    }

    return response.json();
  };

  return {
    async upload(
      filename: string,
      content: Buffer | string,
      options?: { contentType?: string; public?: boolean }
    ): Promise<{ url: string; key: string }> {
      const key = `${namespace}/${filename}`;
      const result = await makeRequest('POST', '/upload', {
        key,
        content: Buffer.isBuffer(content) ? content.toString('base64') : content,
        contentType: options?.contentType,
        public: options?.public,
      });
      return result as { url: string; key: string };
    },

    async download(key: string): Promise<Buffer> {
      const fullKey = key.startsWith(namespace) ? key : `${namespace}/${key}`;
      const result = await makeRequest('GET', `/download/${encodeURIComponent(fullKey)}`);
      const { content } = result as { content: string };
      return Buffer.from(content, 'base64');
    },

    async delete(key: string): Promise<boolean> {
      const fullKey = key.startsWith(namespace) ? key : `${namespace}/${key}`;
      const result = await makeRequest('DELETE', `/${encodeURIComponent(fullKey)}`);
      return (result as { deleted: boolean }).deleted;
    },

    async list(prefix?: string): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
      const fullPrefix = prefix ? `${namespace}/${prefix}` : namespace;
      const result = await makeRequest('GET', `?prefix=${encodeURIComponent(fullPrefix)}`);
      const files = (result as { files: Array<{ key: string; size: number; lastModified: string }> }).files;
      return files.map(f => ({
        key: f.key.replace(`${namespace}/`, ''),
        size: f.size,
        lastModified: new Date(f.lastModified),
      }));
    },

    async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
      const fullKey = key.startsWith(namespace) ? key : `${namespace}/${key}`;
      const result = await makeRequest('POST', '/signed-url', {
        key: fullKey,
        expiresIn,
      });
      return (result as { url: string }).url;
    },

    async exists(key: string): Promise<boolean> {
      const fullKey = key.startsWith(namespace) ? key : `${namespace}/${key}`;
      try {
        const result = await makeRequest('HEAD', `/${encodeURIComponent(fullKey)}`);
        return (result as { exists: boolean }).exists;
      } catch {
        return false;
      }
    },
  };
}

import { isEventKey, type EventKey, type EventSubscription, type PluginEvent } from '../events/registry';
import { parsePluginConfigSchema } from './plugin-config-schema';

export const PLUGIN_CATEGORIES = [
  'payment',
  'shipping',
  'tax',
  'fulfillment',
  'notification',
  'integration',
] as const;

export const PLUGIN_LIFECYCLE_HOOKS = [
  'onInstall',
  'onEnable',
  'onDisable',
  'onUninstall',
  'onUpgrade',
] as const;

export type PluginRuntimeType = 'internal-fastify';

export const INTERNAL_FASTIFY_HOST_PROTOCOL = 'internal-fastify-v1';

export type PluginHostProtocol = typeof INTERNAL_FASTIFY_HOST_PROTOCOL;

/** Plugin gateway business messages are bounded plain text, never HTML. */
export interface PluginBusinessErrorResponse {
  success: false;
  error: { code: string; message: string };
}

/**
 * Trust level assigned to a plugin at install time.
 *
 * - `builtin`      — ships with the Jiffoo distribution itself.
 * - `signed`       — has a verified publisher signature.
 * - `unsigned`     — has no verified publisher signature.
 *
 * Trust describes publisher accountability. Every trust tier uses the same
 * in-process runtime and gateway contract.
 */
export type PluginTrustLevel = 'builtin' | 'signed' | 'unsigned';

export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];
export type LifecycleHookName = (typeof PLUGIN_LIFECYCLE_HOOKS)[number];

export type PluginContractDeclaration = { name: 'payment'; version: 2 }
  | { name: 'shipping' | 'tax' | 'fulfillment' | 'notification'; version: 1 };

export type PluginDatabaseJson = null | boolean | number | string | readonly PluginDatabaseJson[] | { readonly [key: string]: PluginDatabaseJson };
export type PluginDatabaseParameter = PluginDatabaseJson | Date | Uint8Array;
export interface PluginDatabaseOptions { readonly signal?: AbortSignal; }
export interface PluginDatabaseResult<Row extends Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount: number | null;
}
export interface PluginDatabaseTransaction {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly PluginDatabaseParameter[], options?: PluginDatabaseOptions): Promise<PluginDatabaseResult<Row>>;
}
export interface PluginDatabase extends PluginDatabaseTransaction {
  transaction<T>(run: (transaction: PluginDatabaseTransaction) => Promise<T>, options?: PluginDatabaseOptions): Promise<T>;
}

export interface PluginContext {
  plugin: { slug: string; installationId: string; version: string };
  config: Readonly<Record<string, unknown>>;
  /**
   * Parameterized queries and transactions admitted only during a live handler.
   * Plugin code is trusted in-process code. The schema scope prevents accidental
   * use of Core tables; it does not isolate a malicious plugin. Registration,
   * detached timers and captured transactions after settlement cannot use this API.
   */
  readonly database: PluginDatabase;
  logger: { info(message: string, data?: unknown): void; warn(message: string, data?: unknown): void; error(message: string, data?: unknown): void };
  http: { route(route: { method: string; path: string; handler: (...args: any[]) => unknown }): void };
  events: { subscribe<K extends EventKey>(eventType: K, version: 1, handler: (event: PluginEvent<K>) => Promise<unknown> | unknown): void };
  contracts: { implement(name: string, version: number, implementation: Record<string, (input: unknown) => Promise<unknown> | unknown>): void };
}

export interface PluginEntryModule {
  register(ctx: PluginContext): void | Promise<void>;
}

export interface PluginMigrationDeclaration {
  id: string;
  order: number;
  path: string;
  sha256: string;
}

export interface PluginDatabaseDeclaration {
  apiVersion: 1;
  migrations: PluginMigrationDeclaration[];
}

export function pluginDatabaseDeclarationIsValid(value: unknown): value is PluginDatabaseDeclaration {
  if (!isRecord(value) || value.apiVersion !== 1 || !Array.isArray(value.migrations)
    || Object.keys(value).some(key => !['apiVersion', 'migrations'].includes(key))) return false;
  const ids = new Set<string>(), paths = new Set<string>();
  return value.migrations.every((item, index) => {
    if (!isRecord(item) || Object.keys(item).some(key => !['id', 'order', 'path', 'sha256'].includes(key))
      || typeof item.id !== 'string' || !item.id || /[\u0000\uD800-\uDFFF]/u.test(item.id)
      || item.order !== index + 1 || typeof item.path !== 'string'
      || !/^migrations\/[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/.test(item.path) || item.path.includes('..')
      || typeof item.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(item.sha256)
      || ids.has(item.id) || paths.has(item.path)) return false;
    ids.add(item.id); paths.add(item.path); return true;
  });
}

export interface PluginApiVersionRange {
  min?: string;
  max?: string;
  exact?: string;
}

export interface PluginLifecycleDeclaration {
  onInstall?: boolean;
  onEnable?: boolean;
  onDisable?: boolean;
  onUninstall?: boolean;
  onUpgrade?: boolean;
}

export interface PluginManifest {
  schemaVersion: 1;
  slug: string;
  name: string;
  version: string;
  description: string;
  category?: PluginCategory;
  runtimeType: PluginRuntimeType;
  /**
   * The runtime ABI expected by an executable in-process plugin.
   *
   * Required for `internal-fastify` plugins so the host can reject packages
   * built for another plugin runtime before loading their entry module.
   */
  hostProtocol?: PluginHostProtocol;
  entryModule?: string;
  permissions: string[];
  author?: string;
  authorUrl?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  screenshots?: string[];
  minApiVersion?: string;
  sdkVersion?: string;
  requiredApiVersion?: PluginApiVersionRange;
  dependencies?: Record<string, string>;
  tags?: string[];
  configSchema?: Record<string, unknown>;
  contracts?: PluginContractDeclaration[];
  requiredScopes?: string[];
  subscriptions?: EventSubscription[];
  lifecycle?: PluginLifecycleDeclaration;
  database?: PluginDatabaseDeclaration;
}

export interface PluginManifestIssue {
  path: string;
  message: string;
  code: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function isApiVersion(value: string): boolean {
  return /^v\d+$/.test(value) || isSemver(value);
}

function isSlug(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/.test(value);
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function pushIssue(issues: PluginManifestIssue[], path: string, message: string, code: string): void {
  issues.push({ path, message, code });
}

const manifestFields = new Set([
  'schemaVersion', 'slug', 'name', 'version', 'description', 'category',
  'runtimeType', 'hostProtocol', 'entryModule', 'permissions', 'author',
  'authorUrl', 'license', 'homepage', 'repository', 'icon', 'screenshots',
  'minApiVersion', 'sdkVersion', 'requiredApiVersion', 'dependencies', 'tags',
  'configSchema', 'contracts', 'requiredScopes', 'subscriptions', 'lifecycle', 'database',
  'trustLevel', 'capabilities', 'webhooks',
]);

function rejectUnknown(
  issues: PluginManifestIssue[], value: Record<string, unknown>,
  allowed: ReadonlySet<string>, path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      const field = path ? `${path}.${key}` : key;
      pushIssue(issues, field, `${field} is not supported`, 'UNKNOWN_MANIFEST_FIELD');
    }
  }
}

function validateApiVersionRange(
  issues: PluginManifestIssue[],
  value: unknown,
  path: string
): void {
  if (!isRecord(value)) {
    pushIssue(issues, path, `${path} must be an object`, 'INVALID_VERSION_REQUIREMENT');
    return;
  }

  const range = value as PluginApiVersionRange;
  rejectUnknown(issues, value, new Set(['min', 'max', 'exact']), path);
  const hasValue = range.min !== undefined || range.max !== undefined || range.exact !== undefined;

  if (!hasValue) {
    pushIssue(issues, path, `${path} must include at least one of min, max, or exact`, 'INVALID_VERSION_REQUIREMENT');
  }

  (['min', 'max', 'exact'] satisfies Array<keyof PluginApiVersionRange>).forEach((key) => {
    const version = range[key];
    if (version !== undefined && (typeof version !== 'string' || !isApiVersion(version))) {
      pushIssue(
        issues,
        `${path}.${key}`,
        `${path}.${key} must be a valid API version string`,
        'INVALID_VERSION_REQUIREMENT'
      );
    }
  });
}

export function getPluginManifestIssues(manifest: unknown): PluginManifestIssue[] {
  const issues: PluginManifestIssue[] = [];

  if (!isRecord(manifest)) {
    return [{
      path: 'manifest.json',
      message: 'manifest.json must be a JSON object',
      code: 'INVALID_MANIFEST',
    }];
  }

  rejectUnknown(issues, manifest, manifestFields, '');

  if (manifest.database !== undefined && !pluginDatabaseDeclarationIsValid(manifest.database)) {
    pushIssue(issues, 'database', 'Invalid plugin migration declaration', 'PLUGIN_MIGRATION_MANIFEST_INVALID');
  }

  if (manifest.schemaVersion !== 1) {
    pushIssue(issues, 'schemaVersion', 'schemaVersion must be 1', 'INVALID_SCHEMA_VERSION');
  }

  if (typeof manifest.slug !== 'string' || !manifest.slug) {
    pushIssue(issues, 'slug', 'slug is required', 'INVALID_MANIFEST');
  } else if (!isSlug(manifest.slug)) {
    pushIssue(issues, 'slug', 'slug must use lowercase letters, numbers, and hyphens only', 'INVALID_SLUG');
  }

  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    pushIssue(issues, 'name', 'name is required', 'INVALID_MANIFEST');
  }

  if (typeof manifest.version !== 'string' || !manifest.version) {
    pushIssue(issues, 'version', 'version is required', 'INVALID_MANIFEST');
  } else if (!isSemver(manifest.version)) {
    pushIssue(issues, 'version', 'version must use strict semver (MAJOR.MINOR.PATCH)', 'INVALID_VERSION_FORMAT');
  }

  if (typeof manifest.description !== 'string') {
    pushIssue(issues, 'description', 'description is required', 'INVALID_MANIFEST');
  }

  if (manifest.runtimeType !== 'internal-fastify') {
    pushIssue(
      issues,
      'runtimeType',
      'runtimeType must be "internal-fastify"',
      'INVALID_RUNTIME_TYPE'
    );
  }

  if (manifest.trustLevel !== undefined) {
    pushIssue(
      issues,
      'trustLevel',
      'Core decides the trust tier; manifest trustLevel is not allowed',
      'MANIFEST_TRUST_LEVEL_NOT_ALLOWED'
    );
  }

  if (manifest.runtimeType === 'internal-fastify') {
    if (manifest.hostProtocol === undefined) {
      pushIssue(
        issues,
        'hostProtocol',
        'hostProtocol is required for internal-fastify plugins',
        'MISSING_HOST_PROTOCOL'
      );
    } else if (manifest.hostProtocol !== INTERNAL_FASTIFY_HOST_PROTOCOL) {
      pushIssue(
        issues,
        'hostProtocol',
        `hostProtocol must be "${INTERNAL_FASTIFY_HOST_PROTOCOL}" for internal-fastify plugins`,
        'UNSUPPORTED_HOST_PROTOCOL'
      );
    }
  }

  if (!Array.isArray(manifest.permissions)) {
    pushIssue(issues, 'permissions', 'permissions must be an array of strings', 'INVALID_PERMISSIONS');
  } else {
    manifest.permissions.forEach((permission, index) => {
      if (typeof permission !== 'string') {
        pushIssue(issues, `permissions[${index}]`, 'permission values must be strings', 'INVALID_PERMISSIONS');
      }
    });
  }

  if (manifest.runtimeType === 'internal-fastify') {
    if (typeof manifest.entryModule !== 'string' || !manifest.entryModule.trim()) {
      pushIssue(issues, 'entryModule', 'entryModule is required for internal-fastify plugins', 'MISSING_ENTRY_MODULE');
    }
  }

  if (manifest.category !== undefined && !PLUGIN_CATEGORIES.includes(manifest.category as PluginCategory)) {
    pushIssue(issues, 'category', `category must be one of: ${PLUGIN_CATEGORIES.join(', ')}`, 'INVALID_CATEGORY');
  }

  if (manifest.license !== undefined && (typeof manifest.license !== 'string' || !manifest.license.trim())) {
    pushIssue(issues, 'license', 'license must be a non-empty string', 'INVALID_MANIFEST');
  }

  if (manifest.homepage !== undefined && (typeof manifest.homepage !== 'string' || !isUrl(manifest.homepage))) {
    pushIssue(issues, 'homepage', 'homepage must be a valid http(s) URL', 'INVALID_MANIFEST');
  }

  if (manifest.repository !== undefined && (typeof manifest.repository !== 'string' || !isUrl(manifest.repository))) {
    pushIssue(issues, 'repository', 'repository must be a valid http(s) URL', 'INVALID_MANIFEST');
  }

  if (manifest.minApiVersion !== undefined && (typeof manifest.minApiVersion !== 'string' || !isApiVersion(manifest.minApiVersion))) {
    pushIssue(issues, 'minApiVersion', 'minApiVersion must be a valid API version string', 'INVALID_MANIFEST');
  }

  if (manifest.sdkVersion !== undefined && (typeof manifest.sdkVersion !== 'string' || !isSemver(manifest.sdkVersion))) {
    pushIssue(issues, 'sdkVersion', 'sdkVersion must use strict semver (MAJOR.MINOR.PATCH)', 'INVALID_MANIFEST');
  }

  if (manifest.requiredApiVersion !== undefined) {
    validateApiVersionRange(issues, manifest.requiredApiVersion, 'requiredApiVersion');
  }

  if (manifest.capabilities !== undefined) {
    pushIssue(issues, 'capabilities', 'capabilities has been removed; use contracts instead', 'MANIFEST_FIELD_REMOVED');
  }

  if (manifest.contracts !== undefined) {
    if (!Array.isArray(manifest.contracts)) {
      pushIssue(issues, 'contracts', 'contracts must be an array', 'INVALID_CONTRACTS');
    } else {
      manifest.contracts.forEach((contract, index) => {
        if (!isRecord(contract) || !['payment', 'shipping', 'tax', 'fulfillment', 'notification'].includes(String(contract.name)) || contract.version !== (contract.name === 'payment' ? 2 : 1)) {
          pushIssue(issues, `contracts[${index}]`, 'payment requires version 2; other contracts require version 1', 'INVALID_CONTRACTS');
        } else {
          rejectUnknown(issues, contract, new Set(['name', 'version']), `contracts[${index}]`);
        }
      });
    }
  }

  const contracts = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const category = typeof manifest.category === 'string' ? manifest.category : undefined;
  if (category && ['payment', 'shipping', 'tax', 'fulfillment', 'notification'].includes(category) && !contracts.some((contract) => isRecord(contract) && contract.name === category && contract.version === (category === 'payment' ? 2 : 1))) {
    pushIssue(issues, 'contracts', `${category} category requires its version ${category === 'payment' ? 2 : 1} contract`, 'MISSING_CATEGORY_CONTRACT');
  }
  if (manifest.category && manifest.category !== 'integration' && contracts.length === 0) {
    pushIssue(issues, 'contracts', `${manifest.category} category requires a contract declaration`, 'MISSING_CATEGORY_CONTRACT');
  }
  const singleProviderContracts = contracts.filter((contract) => isRecord(contract) && ['tax', 'fulfillment', 'notification'].includes(String(contract.name)));
  if (singleProviderContracts.length > 1) pushIssue(issues, 'contracts', 'only one single-provider contract may be declared', 'MANIFEST_MULTIPLE_SINGLE_PROVIDER_CONTRACTS');

  if (manifest.requiredScopes !== undefined && !isStringArray(manifest.requiredScopes)) {
    pushIssue(issues, 'requiredScopes', 'requiredScopes must be an array of strings', 'INVALID_REQUIRED_SCOPES');
  }

  if (manifest.tags !== undefined && !isStringArray(manifest.tags)) {
    pushIssue(issues, 'tags', 'tags must be an array of strings', 'INVALID_MANIFEST');
  }

  if (manifest.screenshots !== undefined && !isStringArray(manifest.screenshots)) {
    pushIssue(issues, 'screenshots', 'screenshots must be an array of strings', 'INVALID_MANIFEST');
  }

  if (manifest.dependencies !== undefined) {
    if (!isRecord(manifest.dependencies)) {
      pushIssue(issues, 'dependencies', 'dependencies must be an object', 'INVALID_MANIFEST');
    } else {
      for (const [name, range] of Object.entries(manifest.dependencies)) {
        if (!/^(?:@[^/\s]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name)
          || typeof range !== 'string' || !/^(?:\^|~|>=|<=|>|<)?\d+\.\d+\.\d+$/.test(range)) {
          pushIssue(issues, `dependencies.${name}`, `dependencies.${name} must be a package name with a semver range`, 'INVALID_DEPENDENCY');
        }
      }
    }
  }

  if (manifest.configSchema !== undefined) {
    for (const issue of parsePluginConfigSchema(manifest.configSchema).issues) {
      pushIssue(issues, issue.path, `${issue.path}: ${issue.message}`, 'INVALID_CONFIG_SCHEMA');
    }
  }

  if (manifest['webhooks'] !== undefined) {
    pushIssue(issues, 'webhooks', 'webhooks has been removed; use subscriptions', 'MANIFEST_FIELD_REMOVED');
  }
  if (manifest.subscriptions !== undefined) {
    if (!Array.isArray(manifest.subscriptions)) {
      pushIssue(issues, 'subscriptions', 'subscriptions must be an array', 'INVALID_SUBSCRIPTIONS');
    } else {
      const seen = new Set<string>();
      manifest.subscriptions.forEach((declaration, index) => {
        if (!isRecord(declaration) || !isEventKey(declaration.type) || declaration.version !== 1
          || Object.keys(declaration).some((key) => key !== 'type' && key !== 'version')) {
          pushIssue(issues, `subscriptions[${index}]`, 'only known event type and version 1 are allowed', 'INVALID_SUBSCRIPTIONS');
          return;
        }
        const key = `${declaration.type}:${declaration.version}`;
        if (seen.has(key)) pushIssue(issues, `subscriptions[${index}]`, 'duplicate subscription', 'INVALID_SUBSCRIPTIONS');
        seen.add(key);
      });
    }
  }

  if (manifest.lifecycle !== undefined) {
    if (!isRecord(manifest.lifecycle)) {
      pushIssue(issues, 'lifecycle', 'lifecycle must be an object', 'INVALID_LIFECYCLE');
    } else {
      const lifecycle = manifest.lifecycle as Record<string, unknown>;
      PLUGIN_LIFECYCLE_HOOKS.forEach((hookName) => {
        const value = lifecycle[hookName];
        if (value !== undefined && typeof value !== 'boolean') {
          pushIssue(issues, `lifecycle.${hookName}`, `${hookName} must be a boolean`, 'INVALID_LIFECYCLE');
        }
      });
      rejectUnknown(issues, lifecycle, new Set(PLUGIN_LIFECYCLE_HOOKS), 'lifecycle');
    }
  }

  return issues;
}

export function isPluginManifest(manifest: unknown): manifest is PluginManifest {
  return getPluginManifestIssues(manifest).length === 0;
}

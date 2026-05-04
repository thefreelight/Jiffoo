export const PLUGIN_CATEGORIES = [
  'payment',
  'email',
  'integration',
  'theme',
  'analytics',
  'marketing',
  'shipping',
  'seo',
  'social',
  'security',
  'other',
] as const;

export const PLUGIN_CAPABILITIES = [
  'webhook.receive',
  'webhook.send',
  'api.read',
  'api.write',
  'admin.panel',
  'storefront.widget',
  'checkout.modify',
  'order.process',
  'payment.process',
  'payment.refund',
  'shipping.calculate',
  'shipping.track',
  'email.send',
  'email.template',
  'sms.send',
  'analytics.track',
  'analytics.report',
  'seo.sitemap',
  'seo.meta',
  'customer.sync',
  'inventory.sync',
  'product.sync',
] as const;

export const PLUGIN_LIFECYCLE_HOOKS = [
  'onInstall',
  'onEnable',
  'onDisable',
  'onUninstall',
  'onUpgrade',
] as const;

export const PLUGIN_THEME_EMBED_TARGETS = [
  'head-end',
  'body-end',
] as const;

export type PluginRuntimeType = 'internal-fastify' | 'external-http';
export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];
export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];
export type LifecycleHookName = (typeof PLUGIN_LIFECYCLE_HOOKS)[number];
export type ThemeExtensionKind = 'app_block' | 'app_embed';
export type PluginThemeEmbedTarget = (typeof PLUGIN_THEME_EMBED_TARGETS)[number];

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

export interface PluginThemeBlockExtension {
  extensionId: string;
  name: string;
  schema?: Record<string, unknown>;
  dataEndpoint?: string;
}

export interface PluginThemeEmbedExtension {
  extensionId: string;
  name: string;
  targetPosition: PluginThemeEmbedTarget;
  schema?: Record<string, unknown>;
  dataEndpoint?: string;
}

export interface PluginThemeExtensions {
  blocks?: PluginThemeBlockExtension[];
  embeds?: PluginThemeEmbedExtension[];
}

export interface PluginWebhookDeclaration {
  events: string[];
  url: string;
}

export interface PluginManifest {
  schemaVersion: 1;
  slug: string;
  name: string;
  version: string;
  description: string;
  category?: PluginCategory;
  runtimeType: PluginRuntimeType;
  entryModule?: string;
  externalBaseUrl?: string;
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
  capabilities?: string[];
  requiredScopes?: string[];
  webhooks?: PluginWebhookDeclaration;
  lifecycle?: PluginLifecycleDeclaration;
  themeExtensions?: PluginThemeExtensions;
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

function isInternalWebhookPath(value: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/.test(value);
}

function pushIssue(issues: PluginManifestIssue[], path: string, message: string, code: string): void {
  issues.push({ path, message, code });
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

function validateThemeExtensionItem(
  issues: PluginManifestIssue[],
  item: unknown,
  path: string,
  kind: ThemeExtensionKind
): void {
  if (!isRecord(item)) {
    pushIssue(issues, path, `${path} must be an object`, 'INVALID_THEME_EXTENSION');
    return;
  }

  if (typeof item.extensionId !== 'string' || !item.extensionId.trim()) {
    pushIssue(issues, `${path}.extensionId`, 'extensionId is required', 'INVALID_THEME_EXTENSION');
  }

  if (typeof item.name !== 'string' || !item.name.trim()) {
    pushIssue(issues, `${path}.name`, 'name is required', 'INVALID_THEME_EXTENSION');
  }

  if (item.schema !== undefined && !isRecord(item.schema)) {
    pushIssue(issues, `${path}.schema`, 'schema must be an object', 'INVALID_THEME_EXTENSION');
  }

  if (item.dataEndpoint !== undefined && (typeof item.dataEndpoint !== 'string' || !item.dataEndpoint.startsWith('/'))) {
    pushIssue(issues, `${path}.dataEndpoint`, 'dataEndpoint must start with "/"', 'INVALID_THEME_EXTENSION');
  }

  if (kind === 'app_embed') {
    if (!PLUGIN_THEME_EMBED_TARGETS.includes(item.targetPosition as PluginThemeEmbedTarget)) {
      pushIssue(
        issues,
        `${path}.targetPosition`,
        'targetPosition must be "head-end" or "body-end"',
        'INVALID_THEME_EXTENSION'
      );
    }
  }
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

  if (manifest.runtimeType !== 'internal-fastify' && manifest.runtimeType !== 'external-http') {
    pushIssue(
      issues,
      'runtimeType',
      'runtimeType must be "internal-fastify" or "external-http"',
      'INVALID_RUNTIME_TYPE'
    );
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

  if (manifest.runtimeType === 'external-http') {
    if (typeof manifest.externalBaseUrl !== 'string' || !manifest.externalBaseUrl.trim()) {
      pushIssue(issues, 'externalBaseUrl', 'externalBaseUrl is required for external-http plugins', 'MISSING_EXTERNAL_BASE_URL');
    } else if (!isUrl(manifest.externalBaseUrl)) {
      pushIssue(issues, 'externalBaseUrl', 'externalBaseUrl must be a valid http(s) URL', 'INVALID_EXTERNAL_BASE_URL');
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
    if (!isStringArray(manifest.capabilities)) {
      pushIssue(issues, 'capabilities', 'capabilities must be an array of strings', 'INVALID_CAPABILITIES');
    } else {
      manifest.capabilities.forEach((capability, index) => {
        if (!PLUGIN_CAPABILITIES.includes(capability as PluginCapability)) {
          pushIssue(issues, `capabilities[${index}]`, `unsupported capability "${capability}"`, 'INVALID_CAPABILITIES');
        }
      });
    }
  }

  if (manifest.requiredScopes !== undefined && !isStringArray(manifest.requiredScopes)) {
    pushIssue(issues, 'requiredScopes', 'requiredScopes must be an array of strings', 'INVALID_REQUIRED_SCOPES');
  }

  if (manifest.tags !== undefined && !isStringArray(manifest.tags)) {
    pushIssue(issues, 'tags', 'tags must be an array of strings', 'INVALID_MANIFEST');
  }

  if (manifest.screenshots !== undefined && !isStringArray(manifest.screenshots)) {
    pushIssue(issues, 'screenshots', 'screenshots must be an array of strings', 'INVALID_MANIFEST');
  }

  if (manifest.dependencies !== undefined && !isRecord(manifest.dependencies)) {
    pushIssue(issues, 'dependencies', 'dependencies must be an object', 'INVALID_MANIFEST');
  }

  if (manifest.configSchema !== undefined && !isRecord(manifest.configSchema)) {
    pushIssue(issues, 'configSchema', 'configSchema must be an object', 'INVALID_MANIFEST');
  }

  if (manifest.webhooks !== undefined) {
    if (!isRecord(manifest.webhooks)) {
      pushIssue(issues, 'webhooks', 'webhooks must be an object', 'INVALID_WEBHOOKS');
    } else {
      if (!isStringArray(manifest.webhooks.events) || manifest.webhooks.events.length === 0) {
        pushIssue(issues, 'webhooks.events', 'webhooks.events must be a non-empty array of strings', 'INVALID_WEBHOOKS');
      }
      if (typeof manifest.webhooks.url !== 'string' || !manifest.webhooks.url.trim()) {
        pushIssue(issues, 'webhooks.url', 'webhooks.url is required', 'INVALID_WEBHOOKS');
      } else if (!isUrl(manifest.webhooks.url) && !isInternalWebhookPath(manifest.webhooks.url)) {
        pushIssue(issues, 'webhooks.url', 'webhooks.url must be a valid http(s) URL or internal absolute path', 'INVALID_WEBHOOKS');
      }
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
    }
  }

  if (manifest.themeExtensions !== undefined) {
    if (!isRecord(manifest.themeExtensions)) {
      pushIssue(issues, 'themeExtensions', 'themeExtensions must be an object', 'INVALID_THEME_EXTENSION');
    } else {
      if (manifest.themeExtensions.blocks !== undefined) {
        if (!Array.isArray(manifest.themeExtensions.blocks)) {
          pushIssue(issues, 'themeExtensions.blocks', 'blocks must be an array', 'INVALID_THEME_EXTENSION');
        } else {
          manifest.themeExtensions.blocks.forEach((block, index) => {
            validateThemeExtensionItem(issues, block, `themeExtensions.blocks[${index}]`, 'app_block');
          });
        }
      }

      if (manifest.themeExtensions.embeds !== undefined) {
        if (!Array.isArray(manifest.themeExtensions.embeds)) {
          pushIssue(issues, 'themeExtensions.embeds', 'embeds must be an array', 'INVALID_THEME_EXTENSION');
        } else {
          manifest.themeExtensions.embeds.forEach((embed, index) => {
            validateThemeExtensionItem(issues, embed, `themeExtensions.embeds[${index}]`, 'app_embed');
          });
        }
      }
    }
  }

  return issues;
}

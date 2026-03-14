/**
 * Theme App contract
 *
 * Single authoritative contract for executable theme packages.
 */

export const THEME_APP_MANIFEST_FILE = 'theme-app.json';

export const DEFAULT_THEME_APP_HEALTH_CHECK_PATH = '/api/health';
export const DEFAULT_THEME_APP_HEALTH_CHECK_TIMEOUT = 5000;
export const DEFAULT_THEME_APP_HEALTH_CHECK_RETRIES = 3;
export const DEFAULT_THEME_APP_HEALTH_CHECK_RETRY_INTERVAL = 2000;
export const DEFAULT_THEME_APP_PORT_RANGE = { min: 3100, max: 3199 } as const;

export interface ThemeAppManifest {
  schemaVersion: 1;
  slug: string;
  name: string;
  version: string;
  target: 'shop' | 'admin';
  type: 'theme-app';
  description?: string;
  author?: string;
  authorUrl?: string;
  icon?: string;
  screenshots?: string[];
  tags?: string[];
  runtime: {
    kind: 'next-standalone';
    entry: string;
    healthPath?: string;
  };
  port?: {
    preferred?: number;
    range?: { min: number; max: number };
  };
  healthCheck?: {
    path?: string;
    timeout?: number;
    retries?: number;
    retryInterval?: number;
  };
  env?: Record<string, string>;
  defaultConfig?: Record<string, unknown>;
}

export interface ThemeAppHealthCheckConfig {
  path: string;
  timeout: number;
  retries: number;
  retryInterval: number;
}

export interface ThemeAppManifestIssue {
  path: string;
  message: string;
  code: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function getThemeAppManifestIssues(manifest: unknown): ThemeAppManifestIssue[] {
  const issues: ThemeAppManifestIssue[] = [];

  if (!isRecord(manifest)) {
    return [{
      path: 'theme-app.json',
      message: 'theme-app.json must be a JSON object',
      code: 'INVALID_MANIFEST',
    }];
  }

  if (manifest.schemaVersion !== 1) {
    issues.push({
      path: 'schemaVersion',
      message: 'schemaVersion must be 1',
      code: 'INVALID_SCHEMA_VERSION',
    });
  }

  if (manifest.type !== 'theme-app') {
    issues.push({
      path: 'type',
      message: 'type must be "theme-app"',
      code: 'INVALID_MANIFEST',
    });
  }

  if (typeof manifest.slug !== 'string' || !manifest.slug) {
    issues.push({
      path: 'slug',
      message: 'slug is required',
      code: 'INVALID_MANIFEST',
    });
  } else {
    const slugRegex = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;
    if (!slugRegex.test(manifest.slug)) {
      issues.push({
        path: 'slug',
        message: 'slug must start with a lowercase letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens',
        code: 'INVALID_SLUG',
      });
    }
  }

  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    issues.push({
      path: 'name',
      message: 'name is required',
      code: 'INVALID_MANIFEST',
    });
  }

  if (typeof manifest.version !== 'string' || !manifest.version) {
    issues.push({
      path: 'version',
      message: 'version is required',
      code: 'INVALID_MANIFEST',
    });
  } else {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(manifest.version)) {
      issues.push({
        path: 'version',
        message: 'version must use strict semver (MAJOR.MINOR.PATCH)',
        code: 'INVALID_VERSION_FORMAT',
      });
    }
  }

  if (manifest.target !== 'shop' && manifest.target !== 'admin') {
    issues.push({
      path: 'target',
      message: 'target must be "shop" or "admin"',
      code: 'INVALID_MANIFEST',
    });
  }

  if (!isRecord(manifest.runtime)) {
    issues.push({
      path: 'runtime',
      message: 'runtime is required',
      code: 'INVALID_MANIFEST',
    });
  } else {
    if (manifest.runtime.kind !== 'next-standalone') {
      issues.push({
        path: 'runtime.kind',
        message: 'runtime.kind must be "next-standalone"',
        code: 'INVALID_RUNTIME',
      });
    }

    if (typeof manifest.runtime.entry !== 'string' || !manifest.runtime.entry) {
      issues.push({
        path: 'runtime.entry',
        message: 'runtime.entry is required',
        code: 'INVALID_RUNTIME',
      });
    }

    if (manifest.runtime.healthPath !== undefined) {
      if (typeof manifest.runtime.healthPath !== 'string' || !manifest.runtime.healthPath.startsWith('/')) {
        issues.push({
          path: 'runtime.healthPath',
          message: 'runtime.healthPath must be an absolute path starting with "/"',
          code: 'INVALID_RUNTIME',
        });
      }
    }
  }

  if (manifest.port !== undefined) {
    if (!isRecord(manifest.port)) {
      issues.push({
        path: 'port',
        message: 'port must be an object when provided',
        code: 'INVALID_PORT',
      });
    } else {
      if (manifest.port.preferred !== undefined && !isPositiveInteger(manifest.port.preferred)) {
        issues.push({
          path: 'port.preferred',
          message: 'port.preferred must be a positive integer',
          code: 'INVALID_PORT',
        });
      }

      if (manifest.port.range !== undefined) {
        if (!isRecord(manifest.port.range)) {
          issues.push({
            path: 'port.range',
            message: 'port.range must be an object when provided',
            code: 'INVALID_PORT',
          });
        } else {
          const { min, max } = manifest.port.range;
          if (!isPositiveInteger(min) || !isPositiveInteger(max) || min > max) {
            issues.push({
              path: 'port.range',
              message: 'port.range must contain positive integer min/max values where min <= max',
              code: 'INVALID_PORT',
            });
          }
        }
      }
    }
  }

  if (manifest.healthCheck !== undefined) {
    if (!isRecord(manifest.healthCheck)) {
      issues.push({
        path: 'healthCheck',
        message: 'healthCheck must be an object when provided',
        code: 'INVALID_HEALTH_CHECK',
      });
    } else {
      const { path, timeout, retries, retryInterval } = manifest.healthCheck;

      if (path !== undefined && (typeof path !== 'string' || !path.startsWith('/'))) {
        issues.push({
          path: 'healthCheck.path',
          message: 'healthCheck.path must be an absolute path starting with "/"',
          code: 'INVALID_HEALTH_CHECK',
        });
      }

      if (timeout !== undefined && !isPositiveInteger(timeout)) {
        issues.push({
          path: 'healthCheck.timeout',
          message: 'healthCheck.timeout must be a positive integer',
          code: 'INVALID_HEALTH_CHECK',
        });
      }

      if (retries !== undefined && !isNonNegativeInteger(retries)) {
        issues.push({
          path: 'healthCheck.retries',
          message: 'healthCheck.retries must be a non-negative integer',
          code: 'INVALID_HEALTH_CHECK',
        });
      }

      if (retryInterval !== undefined && !isPositiveInteger(retryInterval)) {
        issues.push({
          path: 'healthCheck.retryInterval',
          message: 'healthCheck.retryInterval must be a positive integer',
          code: 'INVALID_HEALTH_CHECK',
        });
      }
    }
  }

  if (manifest.env !== undefined) {
    if (!isRecord(manifest.env) || Object.values(manifest.env).some((value) => typeof value !== 'string')) {
      issues.push({
        path: 'env',
        message: 'env must be an object with string values',
        code: 'INVALID_ENV',
      });
    }
  }

  if (manifest.screenshots !== undefined && !isStringArray(manifest.screenshots)) {
    issues.push({
      path: 'screenshots',
      message: 'screenshots must be an array of strings',
      code: 'INVALID_MANIFEST',
    });
  }

  if (manifest.tags !== undefined && !isStringArray(manifest.tags)) {
    issues.push({
      path: 'tags',
      message: 'tags must be an array of strings',
      code: 'INVALID_MANIFEST',
    });
  }

  return issues;
}

export function resolveThemeAppHealthCheck(manifest: ThemeAppManifest): ThemeAppHealthCheckConfig {
  return {
    path: manifest.healthCheck?.path || manifest.runtime.healthPath || DEFAULT_THEME_APP_HEALTH_CHECK_PATH,
    timeout: manifest.healthCheck?.timeout || DEFAULT_THEME_APP_HEALTH_CHECK_TIMEOUT,
    retries: manifest.healthCheck?.retries ?? DEFAULT_THEME_APP_HEALTH_CHECK_RETRIES,
    retryInterval: manifest.healthCheck?.retryInterval || DEFAULT_THEME_APP_HEALTH_CHECK_RETRY_INTERVAL,
  };
}

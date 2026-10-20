/**
 * Marketplace submissions — validation
 *
 * Automated checks run when a developer creates or updates a submission.
 * Errors block submission for review; warnings are surfaced to reviewers.
 */

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

const PLUGIN_CATEGORIES = [
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
];

const CONTRACT_EVENTS = [
  'order.created',
  'order.paid',
  'order.fulfilled',
  'order.cancelled',
  'order.refunded',
  'cart.updated',
  'product.created',
  'product.updated',
  'product.deleted',
  'customer.registered',
  'customer.login',
  'payment.failed',
  'payment.succeeded',
];

const EXTENSION_SURFACES = ['api', 'events', 'adminUI', 'storefront', 'db', 'jobs', 'drivers'];

export type SubmissionKind = 'plugin' | 'theme';

export interface SubmissionManifestInput {
  kind: SubmissionKind;
  slug: string;
  name: string;
  version: string;
  contractVersion?: string;
  category?: string;
  description: string;
  developerName: string;
  developerEmail: string;
  sourceUrl?: string;
  manifest: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function semverLike(version: unknown): boolean {
  return typeof version === 'string' && SEMVER_RE.test(version);
}

function httpsUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a plugin submission manifest (contract v1).
 */
export function validatePluginManifest(
  input: SubmissionManifestInput,
  manifest: Record<string, unknown>,
  report: ValidationIssue[],
): void {
  if (input.contractVersion !== undefined && input.contractVersion !== 'v1') {
    report.push({
      level: 'error',
      code: 'plugin.contract_version',
      message: `Unsupported contract version "${input.contractVersion}"; supported: v1`,
    });
  }

  const manifestId = manifest.id ?? manifest.slug;
  if (typeof manifestId !== 'string' || manifestId !== input.slug) {
    report.push({
      level: 'error',
      code: 'plugin.manifest_id_mismatch',
      message: 'Manifest id/slug must match the submission slug',
    });
  }

  if (!semverLike(manifest.version)) {
    report.push({
      level: 'error',
      code: 'plugin.manifest_version',
      message: 'Manifest version must be semver (e.g. 0.0.1)',
    });
  }

  const contract = manifest.contract;
  if (contract !== undefined && contract !== 'v1') {
    report.push({
      level: 'error',
      code: 'plugin.manifest_contract',
      message: 'Manifest contract must be "v1"',
    });
  }

  const category = manifest.category ?? input.category;
  if (typeof category !== 'string' || !PLUGIN_CATEGORIES.includes(category)) {
    report.push({
      level: 'error',
      code: 'plugin.category',
      message: `category must be one of: ${PLUGIN_CATEGORIES.join(', ')}`,
    });
  }

  const capabilities = manifest.capabilities;
  if (capabilities !== undefined) {
    if (!Array.isArray(capabilities) || capabilities.some((c) => typeof c !== 'string')) {
      report.push({
        level: 'error',
        code: 'plugin.capabilities_type',
        message: 'capabilities must be an array of strings',
      });
    } else {
      for (const capability of capabilities as string[]) {
        if (!CONTRACT_EVENTS.includes(capability) && !/^[a-z]+\.[a-z_.]+$/.test(capability)) {
          report.push({
            level: 'warning',
            code: 'plugin.capability_format',
            message: `Capability "${capability}" is not a contract event and does not look like "group.action"`,
          });
        }
      }
    }
  }

  const uses = manifest.uses;
  if (uses !== undefined) {
    if (!Array.isArray(uses) || uses.some((s) => !EXTENSION_SURFACES.includes(s as string))) {
      report.push({
        level: 'error',
        code: 'plugin.uses',
        message: `uses must be a subset of: ${EXTENSION_SURFACES.join(', ')}`,
      });
    }
  } else {
    report.push({
      level: 'warning',
      code: 'plugin.uses_missing',
      message: 'Manifest does not declare "uses"; declare the extension surfaces this plugin touches',
    });
  }

  const requiredSettings = manifest.requiredSettings;
  if (requiredSettings !== undefined) {
    if (!Array.isArray(requiredSettings) || requiredSettings.some((s) => typeof s !== 'string')) {
      report.push({
        level: 'error',
        code: 'plugin.required_settings_type',
        message: 'requiredSettings must be an array of setting keys',
      });
    }
  }
}

/**
 * Validate a theme submission manifest.
 */
export function validateThemeManifest(
  manifest: Record<string, unknown>,
  report: ValidationIssue[],
): void {
  const target = manifest.target;
  if (target !== 'shop' && target !== 'admin') {
    report.push({
      level: 'error',
      code: 'theme.target',
      message: 'target must be "shop" or "admin"',
    });
  }

  if (!semverLike(manifest.version)) {
    report.push({
      level: 'error',
      code: 'theme.manifest_version',
      message: 'Manifest version must be semver (e.g. 0.1.0)',
    });
  }

  const entry = manifest.entry;
  if (!isPlainObject(entry)) {
    report.push({
      level: 'error',
      code: 'theme.entry_missing',
      message: 'entry must declare theme pack files (tokensCSS, templatesDir, settingsSchema, ...)',
    });
  } else {
    if (typeof entry.tokensCSS !== 'string') {
      report.push({
        level: 'error',
        code: 'theme.tokens_css',
        message: 'entry.tokensCSS is required (design tokens are mandatory for branded rendering)',
      });
    }
    const hasRuntime = typeof entry.runtimeJS === 'string';
    const isTemplateOnly = entry.templatesDir === undefined && !hasRuntime;
    if (isTemplateOnly) {
      report.push({
        level: 'warning',
        code: 'theme.template_only',
        message: 'Template-only pack: the host footer (with attribution) will be inherited',
      });
    }
    if (typeof entry.settingsSchema !== 'string') {
      report.push({
        level: 'warning',
        code: 'theme.settings_schema_missing',
        message: 'No settings schema declared; merchants cannot tune this theme',
      });
    }
  }

  const poweredBy = manifest.poweredBy;
  if (!isPlainObject(poweredBy) || typeof poweredBy.removable !== 'boolean') {
    report.push({
      level: 'error',
      code: 'theme.powered_by',
      message: 'poweredBy must be declared as { "removable": boolean } (free themes: false)',
    });
  } else if (poweredBy.removable === true) {
    report.push({
      level: 'warning',
      code: 'theme.powered_by_removable',
      message: 'removable: true implies a paid theme — expect reviewer questions on pricing',
    });
  }

  const compatibility = manifest.compatibility;
  if (!isPlainObject(compatibility) || !semverLike(compatibility.minCoreVersion)) {
    report.push({
      level: 'warning',
      code: 'theme.compatibility',
      message: 'compatibility.minCoreVersion should be declared as semver',
    });
  }
}

/**
 * Full submission validation: envelope fields + kind-specific manifest checks.
 */
export function validateSubmission(input: SubmissionManifestInput): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (!SLUG_RE.test(input.slug)) {
    issues.push({
      level: 'error',
      code: 'envelope.slug_format',
      message: 'slug must be kebab-case (lowercase letters, digits, dashes)',
    });
  }

  if (!semverLike(input.version)) {
    issues.push({
      level: 'error',
      code: 'envelope.version_format',
      message: 'version must be semver (e.g. 0.0.1)',
    });
  }

  if (!input.name.trim()) {
    issues.push({ level: 'error', code: 'envelope.name', message: 'name is required' });
  }

  if (input.description.trim().length < 20) {
    issues.push({
      level: 'error',
      code: 'envelope.description',
      message: 'description must be at least 20 characters',
    });
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.developerEmail)) {
    issues.push({ level: 'error', code: 'envelope.email', message: 'developerEmail must be a valid email' });
  }

  if (input.sourceUrl !== undefined && !httpsUrl(input.sourceUrl)) {
    issues.push({
      level: 'error',
      code: 'envelope.source_url',
      message: 'sourceUrl must be an https URL (public source repository)',
    });
  } else if (input.sourceUrl === undefined) {
    issues.push({
      level: 'warning',
      code: 'envelope.source_url_missing',
      message: 'No sourceUrl provided; reviewers expect a public source repository',
    });
  }

  if (input.kind === 'plugin') {
    validatePluginManifest(input, input.manifest, issues);
  } else {
    validateThemeManifest(input.manifest, issues);
  }

  return { ok: !issues.some((issue) => issue.level === 'error'), issues };
}

/**
 * Check whether the artifact reference is acceptable for review submission.
 */
export function validateArtifactUrl(artifactUrl: string): ValidationIssue | null {
  if (!httpsUrl(artifactUrl)) {
    return {
      level: 'error',
      code: 'artifact.url',
      message: 'artifactUrl must be an https URL to a .zip / .jplugin / .jtheme artifact',
    };
  }
  return null;
}

/**
 * Plugin Trust Level Enforcement (Task 2.3)
 *
 * Implements the two-tier trust model for plugin installation:
 * - `builtin`    — ships with the Jiffoo distribution
 * - `official`   — signed by a trusted Ed25519 key
 * - `third-party` — unsigned or signed by an unknown key
 *
 * Enforcement rules:
 * - `internal-fastify` + `third-party` → REJECTED (task 2.3.2)
 * - `internal-fastify` + `official`/`builtin` → ALLOWED
 * - `external-http` + any trust level → ALLOWED
 *
 * Grace mode (task 2.3.3):
 * - Already-installed third-party internal-fastify plugins are NOT disabled
 * - A warn log is emitted at startup
 * - Admin plugin center shows a yellow warning banner
 * - The `INTERNAL_PLUGIN_ENFORCEMENT_VERSION` constant records when enforcement
 *   becomes mandatory (next minor version)
 */

import type { PluginRuntimeType, PluginTrustLevel } from '@jiffoo/shared';
import type { SignatureVerifyResult } from './signature-verifier';
import { LoggerService } from '@/core/logger/unified-logger';

// ============================================================================
// Constants
// ============================================================================

/**
 * The version where internal-fastify trust level enforcement becomes mandatory.
 *
 * Currently in grace mode: third-party internal-fastify plugins emit warnings
 * but are not disabled. In this version, they will be refused at startup.
 */
export const INTERNAL_PLUGIN_ENFORCEMENT_VERSION = '1.2.0';

/**
 * Error code returned when a third-party plugin attempts internal-fastify installation.
 */
export const THIRD_PARTY_INTERNAL_ERROR_CODE = 'THIRD_PARTY_INTERNAL_NOT_ALLOWED';

/**
 * Documentation URL shown in the rejection error message.
 */
export const TRUST_LEVEL_DOC_URL =
  'https://github.com/jiffoo/jiffoo/blob/main/EXTERNAL_PLUGIN_DEVELOPMENT_GUIDE.md#licensing--commercial-distribution';

// ============================================================================
// Trust Level Derivation
// ============================================================================

/**
 * Derive the trust level of a plugin from its source and signature verification result.
 *
 * @param source - Extension source ('builtin' | 'local-zip' | 'official-market')
 * @param runtimeType - Plugin runtime type
 * @param signatureResult - Result of Ed25519 signature verification (if performed)
 * @param manifestTrustLevel - Trust level declared in the manifest (if present)
 * @returns The derived trust level
 */
export function deriveTrustLevel(
  source: string | undefined | null,
  runtimeType: PluginRuntimeType,
  signatureResult?: SignatureVerifyResult | null,
  manifestTrustLevel?: PluginTrustLevel,
): PluginTrustLevel {
  // Builtin plugins always get 'builtin' trust level
  if (source === 'builtin') {
    return 'builtin';
  }

  // If signature was verified by a trusted key, it's 'official'
  if (signatureResult?.verified) {
    return 'official';
  }

  // If the manifest explicitly declares 'builtin' or 'official' and the source
  // is 'official-market', trust the declaration (the marketplace enforces signing)
  if (source === 'official-market' && (manifestTrustLevel === 'builtin' || manifestTrustLevel === 'official')) {
    return manifestTrustLevel;
  }

  // Everything else is third-party
  return 'third-party';
}

// ============================================================================
// Installation Enforcement (Task 2.3.2)
// ============================================================================

export interface TrustLevelEnforcementError {
  code: typeof THIRD_PARTY_INTERNAL_ERROR_CODE;
  message: string;
  docUrl: string;
  details: {
    runtimeType: PluginRuntimeType;
    trustLevel: PluginTrustLevel;
    enforcementVersion: string;
  };
}

/**
 * Check whether a plugin installation should be rejected based on trust level.
 *
 * Per the two-tier trust model (R2):
 * - `internal-fastify` + `third-party` → REJECTED
 * - All other combinations → ALLOWED
 *
 * @param runtimeType - Plugin runtime type
 * @param trustLevel - Derived trust level
 * @returns Error object if installation should be rejected, null otherwise
 */
export function checkInstallationAllowed(
  runtimeType: PluginRuntimeType,
  trustLevel: PluginTrustLevel,
): TrustLevelEnforcementError | null {
  if (runtimeType === 'internal-fastify' && trustLevel === 'third-party') {
    return {
      code: THIRD_PARTY_INTERNAL_ERROR_CODE,
      message:
        `Third-party plugins must use runtimeType "external-http". ` +
        `Internal-fastify runtime is restricted to builtin and official trust levels. ` +
        `See ${TRUST_LEVEL_DOC_URL} for migration guidance.`,
      docUrl: TRUST_LEVEL_DOC_URL,
      details: {
        runtimeType,
        trustLevel,
        enforcementVersion: INTERNAL_PLUGIN_ENFORCEMENT_VERSION,
      },
    };
  }

  return null;
}

// ============================================================================
// Grace Mode (Task 2.3.3)
// ============================================================================

export interface GraceModeWarning {
  slug: string;
  trustLevel: PluginTrustLevel;
  message: string;
}

/**
 * Check if a plugin is in grace mode (existing third-party internal-fastify plugin).
 *
 * In grace mode, the plugin continues to run but a warning is emitted.
 * This applies only to plugins installed BEFORE the trust level enforcement
 * was added — new installations of third-party internal-fastify plugins are
 * rejected outright by `checkInstallationAllowed`.
 *
 * @param slug - Plugin slug
 * @param runtimeType - Plugin runtime type
 * @param trustLevel - Plugin trust level
 * @returns Grace mode warning if applicable, null otherwise
 */
export function checkGraceMode(
  slug: string,
  runtimeType: PluginRuntimeType,
  trustLevel: PluginTrustLevel | undefined,
): GraceModeWarning | null {
  if (runtimeType !== 'internal-fastify') {
    return null;
  }

  if (trustLevel === 'builtin' || trustLevel === 'official') {
    return null;
  }

  // trustLevel is 'third-party' or undefined (legacy install without trust level)
  const effectiveTrustLevel = trustLevel || 'third-party';

  return {
    slug,
    trustLevel: effectiveTrustLevel,
    message:
      `Plugin "${slug}" is running as internal-fastify with trust level "${effectiveTrustLevel}". ` +
      `Starting from v${INTERNAL_PLUGIN_ENFORCEMENT_VERSION}, third-party internal-fastify plugins ` +
      `will be disabled. Please migrate to external-http runtime or obtain an official signature. ` +
      `See ${TRUST_LEVEL_DOC_URL} for details.`,
  };
}

/**
 * Log grace mode warnings for a list of plugins at startup.
 *
 * @param plugins - Array of plugin info to check
 */
export function logGraceModeWarnings(
  plugins: Array<{ slug: string; runtimeType: string; trustLevel?: string }>,
): void {
  for (const plugin of plugins) {
    const warning = checkGraceMode(
      plugin.slug,
      plugin.runtimeType as PluginRuntimeType,
      plugin.trustLevel as PluginTrustLevel | undefined,
    );

    if (warning) {
      LoggerService.log('warn', warning.message, {
        context: 'trust-level.grace-mode',
        slug: plugin.slug,
        trustLevel: warning.trustLevel,
      });
    }
  }
}

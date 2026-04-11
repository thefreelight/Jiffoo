/**
 * Upgrade Module OpenAPI Schemas
 */

import {
  createTypedReadResponses,
  createTypedUpdateResponses,
  createTypedCreateResponses,
} from '@/types/common-dto';

// ============================================================================
// Version Info Schema
// ============================================================================

const versionInfoSchema = {
  type: 'object',
  properties: {
    currentVersion: { type: 'string', description: 'Current system version' },
    latestVersion: { type: 'string', description: 'Latest available version' },
    updateAvailable: { type: 'boolean', description: 'Whether an update is available' },
    releaseNotes: { type: 'string', nullable: true, description: 'Release notes for latest version' },
    changelogUrl: { type: 'string', nullable: true, description: 'Public changelog URL for the latest release' },
    sourceArchiveUrl: { type: 'string', nullable: true, description: 'Public source archive URL for the latest release' },
    releaseDate: { type: 'string', nullable: true, description: 'Release date for the latest version' },
    releaseChannel: {
      type: 'string',
      enum: ['stable', 'prerelease'],
      description: 'Update channel currently used for version detection',
    },
    deploymentMode: {
      type: 'string',
      enum: ['single-host', 'docker-compose', 'k8s', 'unsupported'],
      description: 'Detected self-hosted deployment mode',
    },
    deploymentModeSource: {
      type: 'string',
      enum: ['env', 'k8s-signals', 'compose-signals', 'single-host-signals', 'fallback'],
      description: 'How the deployment mode was detected',
    },
    deploymentModeReason: { type: 'string', nullable: true, description: 'Human-readable deployment mode detection reason' },
    oneClickUpgradeSupported: { type: 'boolean', description: 'Whether one-click core upgrade is supported for this deployment mode' },
    updateSource: {
      type: 'string',
      enum: ['env-manifest', 'default-public-manifest', 'local-fallback'],
      description: 'Where latest-version information came from',
    },
    manifestUrl: { type: 'string', nullable: true, description: 'Manifest URL consulted for update checks' },
    manifestStatus: {
      type: 'string',
      enum: ['available', 'missing', 'unreachable', 'invalid'],
      description: 'State of the public update manifest lookup',
    },
    manifestError: { type: 'string', nullable: true, description: 'Manifest lookup error details when unavailable' },
    minimumAutoUpgradableVersion: {
      type: 'string',
      nullable: true,
      description: 'Minimum version that can use the one-click path without manual intervention',
    },
    requiresManualIntervention: {
      type: 'boolean',
      description: 'Whether the latest release requires operator-guided manual intervention',
    },
    recoveryMode: {
      type: 'string',
      enum: ['automatic-recovery'],
      description: 'Failure handling mode exposed to the admin UI',
    },
    manualGuidance: { type: 'string', nullable: true, description: 'Operator guidance when one-click upgrade is not supported' },
  },
  required: [
    'currentVersion',
    'latestVersion',
    'updateAvailable',
    'releaseChannel',
    'deploymentMode',
    'deploymentModeSource',
    'oneClickUpgradeSupported',
    'updateSource',
    'manifestStatus',
    'requiresManualIntervention',
    'recoveryMode',
  ],
} as const;

const publicManifestSchema = {
  type: 'object',
  properties: {
    latestVersion: { type: 'string', description: 'Latest public version available for self-hosted updates' },
    latestStableVersion: { type: 'string', description: 'Latest stable public version' },
    latestPrereleaseVersion: { type: 'string', nullable: true, description: 'Latest prerelease version if published' },
    channel: {
      type: 'string',
      enum: ['stable', 'prerelease'],
      description: 'Release channel represented by this manifest payload',
    },
    releaseDate: { type: 'string', description: 'Release publication date' },
    changelogUrl: { type: 'string', description: 'Public changelog URL for this release' },
    sourceArchiveUrl: { type: 'string', description: 'Public source archive URL for this release' },
    minimumCompatibleVersion: { type: 'string', description: 'Minimum compatible version that can read this release' },
    minimumAutoUpgradableVersion: {
      type: 'string',
      description: 'Minimum version that can use one-click upgrade without manual intervention',
    },
    requiresManualIntervention: { type: 'boolean', description: 'Whether operators must perform manual upgrade steps' },
    releaseNotes: { type: 'string', nullable: true, description: 'Short release summary' },
    checksumUrl: { type: 'string', nullable: true, description: 'Optional checksum file URL' },
    signatureUrl: { type: 'string', nullable: true, description: 'Optional signature file URL' },
  },
  required: [
    'latestVersion',
    'latestStableVersion',
    'latestPrereleaseVersion',
    'channel',
    'releaseDate',
    'changelogUrl',
    'sourceArchiveUrl',
    'minimumCompatibleVersion',
    'minimumAutoUpgradableVersion',
    'requiresManualIntervention',
    'releaseNotes',
    'checksumUrl',
    'signatureUrl',
  ],
} as const;

// ============================================================================
// Compatibility Check Schema
// ============================================================================

const compatibilitySchema = {
  type: 'object',
  properties: {
    compatible: { type: 'boolean', description: 'Whether upgrade is compatible' },
    currentVersion: { type: 'string', description: 'Current version' },
    targetVersion: { type: 'string', description: 'Target version' },
    issues: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of compatibility issues',
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of warnings',
    },
  },
  required: ['compatible', 'currentVersion', 'targetVersion'],
} as const;

// ============================================================================
// Upgrade Status Schema
// ============================================================================

const upgradeStatusSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['idle', 'checking', 'preparing', 'downloading', 'backing_up', 'applying', 'migrating', 'verifying', 'completed', 'failed', 'recovered'],
      description: 'Current upgrade status',
    },
    progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
    currentStep: { type: 'string', nullable: true, description: 'Current step description' },
    error: { type: 'string', nullable: true, description: 'Error message if failed' },
  },
  required: ['status', 'progress'],
} as const;

// ============================================================================
// Backup Schema
// ============================================================================

const backupSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Backup ID' },
    version: { type: 'string', description: 'Version at backup time' },
    createdAt: { type: 'string', format: 'date-time', description: 'Backup creation time' },
    size: { type: 'number', description: 'Backup size in bytes' },
  },
  required: ['id', 'version', 'createdAt'],
} as const;

const performUpgradeResultSchema = {
  type: 'object',
  properties: {
    targetVersion: { type: 'string', description: 'Version that was upgraded to' },
    started: { type: 'boolean', description: 'Whether the upgrade was accepted and started' },
    completed: { type: 'boolean', description: 'Whether the upgrade completed within the initiating request' },
    completedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Upgrade completion time if already finished' },
  },
  required: ['targetVersion', 'started', 'completed'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const upgradeSchemas = {
  // GET /api/upgrade/manifest.json
  getPublicManifest: {
    response: {
      200: publicManifestSchema,
    },
  },

  // GET /api/upgrade/version
  getVersion: {
    response: createTypedReadResponses(versionInfoSchema),
  },

  // POST /api/upgrade/check
  checkCompatibility: {
    body: {
      type: 'object',
      required: ['targetVersion'],
      properties: {
        targetVersion: { type: 'string', description: 'Target version to check compatibility' },
      },
    },
    response: createTypedCreateResponses(compatibilitySchema),
  },

  // GET /api/upgrade/status
  getStatus: {
    response: createTypedReadResponses(upgradeStatusSchema),
  },

  // POST /api/upgrade/backup
  createBackup: {
    response: createTypedCreateResponses(backupSchema),
  },

  // POST /api/upgrade/perform
  performUpgrade: {
    body: {
      type: 'object',
      required: ['targetVersion'],
      properties: {
        targetVersion: { type: 'string', description: 'Target version to upgrade to' },
      },
    },
    response: createTypedUpdateResponses(performUpgradeResultSchema),
  },
} as const;

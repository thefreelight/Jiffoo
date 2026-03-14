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
    deploymentMode: {
      type: 'string',
      enum: ['single-host', 'docker-compose', 'k8s', 'unsupported'],
      description: 'Detected self-hosted deployment mode',
    },
    oneClickUpgradeSupported: { type: 'boolean', description: 'Whether one-click core upgrade is supported for this deployment mode' },
    updateSource: {
      type: 'string',
      enum: ['public-manifest', 'local-fallback'],
      description: 'Where latest-version information came from',
    },
    recoveryMode: {
      type: 'string',
      enum: ['automatic-recovery'],
      description: 'Failure handling mode exposed to the admin UI',
    },
    manualGuidance: { type: 'string', nullable: true, description: 'Operator guidance when one-click upgrade is not supported' },
  },
  required: ['currentVersion', 'latestVersion', 'updateAvailable', 'deploymentMode', 'oneClickUpgradeSupported', 'updateSource', 'recoveryMode'],
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
    upgraded: { type: 'boolean', description: 'Whether upgrade completed successfully' },
    completedAt: { type: 'string', format: 'date-time', description: 'Upgrade completion time' },
  },
  required: ['targetVersion', 'upgraded', 'completedAt'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const upgradeSchemas = {
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

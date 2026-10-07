import type { PluginInstall } from '@prisma/client';
import { ApiError } from '@/utils/api-errors';
import { getPluginManifestIssues, isPluginManifest, type PluginManifest, type PluginManifestIssue } from '@jiffoo/shared';

export class InvalidStoredManifestError extends ApiError {

  constructor(
    readonly slug: string,
    readonly issues: PluginManifestIssue[],
  ) {
    super('INVALID_STORED_MANIFEST');
    this.message = `Stored manifest for plugin "${slug}" is invalid: ${issues.map(issue => issue.path).join(', ')}`;
    this.name = 'InvalidStoredManifestError';
  }
}

export function readStoredPluginManifest(plugin: PluginInstall): PluginManifest {
  const manifest = plugin.manifestJson;
  const issues = getPluginManifestIssues(manifest);
  if (issues.length > 0 || !isPluginManifest(manifest)) {
    throw new InvalidStoredManifestError(plugin.slug, issues);
  }
  return manifest;
}

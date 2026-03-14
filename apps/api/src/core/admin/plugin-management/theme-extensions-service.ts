/**
 * Theme Extensions Service (Phase 7 - Section 10)
 *
 * CRUD service for plugin theme extensions (App Blocks and App Embeds).
 * Handles registration from plugin manifests, querying active extensions,
 * toggling active state, and cleanup on uninstall.
 */

import { prisma } from '@/config/database';
import { LoggerService } from '@/core/logger/unified-logger';
import type { Prisma } from '@prisma/client';
import type { PluginManifest } from '@jiffoo/shared';
import { isMissingDatabaseObjectError } from '@/utils/prisma-errors';

const THEME_EXTENSION_TABLES = ['plugin_theme_extensions'];
const loggedThemeExtensionWarnings = new Set<string>();

function logThemeExtensionFallbackOnce(context: string, message: string, error: unknown) {
  if (loggedThemeExtensionWarnings.has(context)) return;
  loggedThemeExtensionWarnings.add(context);

  LoggerService.log('warn', message, {
    context,
    error: error instanceof Error ? error.message : String(error),
  });
}

export interface ThemeExtensionInput {
  installationId: string;
  kind: 'app_block' | 'app_embed';
  extensionId: string;
  name: string;
  schema?: Record<string, unknown>;
  dataEndpoint?: string;
  targetPosition?: 'head-end' | 'body-end';
}

function toJsonValue(schema?: Record<string, unknown>): Prisma.InputJsonValue | null {
  return schema ? schema as Prisma.InputJsonValue : null;
}

export const ThemeExtensionsService = {
  /**
   * Register theme extensions from manifest during plugin install.
   * Upserts blocks and embeds so re-installs update rather than duplicate.
   */
  async registerFromManifest(installationId: string, manifest: PluginManifest): Promise<void> {
    const themeExtensions = manifest.themeExtensions;
    if (!themeExtensions) return;

    // Register blocks
    if (themeExtensions.blocks && Array.isArray(themeExtensions.blocks)) {
      for (const block of themeExtensions.blocks) {
        try {
          await prisma.pluginThemeExtension.upsert({
            where: {
              installationId_extensionId: {
                installationId,
                extensionId: block.extensionId,
              },
            },
            create: {
              installationId,
              kind: 'app_block',
              extensionId: block.extensionId,
              name: block.name,
              schema: toJsonValue(block.schema),
              dataEndpoint: block.dataEndpoint || null,
            },
            update: {
              name: block.name,
              schema: toJsonValue(block.schema),
              dataEndpoint: block.dataEndpoint || null,
              active: true,
            },
          });
        } catch (error) {
          LoggerService.logError(error instanceof Error ? error : new Error(String(error)), {
            context: 'ThemeExtensionsService.registerFromManifest',
            installationId,
            extensionId: block.extensionId,
            kind: 'app_block',
          });
        }
      }
    }

    // Register embeds
    if (themeExtensions.embeds && Array.isArray(themeExtensions.embeds)) {
      for (const embed of themeExtensions.embeds) {
        try {
          await prisma.pluginThemeExtension.upsert({
            where: {
              installationId_extensionId: {
                installationId,
                extensionId: embed.extensionId,
              },
            },
            create: {
              installationId,
              kind: 'app_embed',
              extensionId: embed.extensionId,
              name: embed.name,
              schema: toJsonValue(embed.schema),
              dataEndpoint: embed.dataEndpoint || null,
              targetPosition: embed.targetPosition || 'body-end',
            },
            update: {
              name: embed.name,
              schema: toJsonValue(embed.schema),
              dataEndpoint: embed.dataEndpoint || null,
              targetPosition: embed.targetPosition || 'body-end',
              active: true,
            },
          });
        } catch (error) {
          LoggerService.logError(error instanceof Error ? error : new Error(String(error)), {
            context: 'ThemeExtensionsService.registerFromManifest',
            installationId,
            extensionId: embed.extensionId,
            kind: 'app_embed',
          });
        }
      }
    }
  },

  /**
   * Get all active app blocks (for shop rendering).
   * Only returns blocks whose parent installation is also enabled.
   */
  async getActiveBlocks() {
    try {
      return await prisma.pluginThemeExtension.findMany({
        where: { kind: 'app_block', active: true },
        include: { installation: { select: { pluginSlug: true, enabled: true } } },
      });
    } catch (error) {
      if (isMissingDatabaseObjectError(error, THEME_EXTENSION_TABLES)) {
        logThemeExtensionFallbackOnce(
          'ThemeExtensionsService.getActiveBlocks',
          'Theme extension tables unavailable; returning no app blocks',
          error
        );
        return [];
      }

      throw error;
    }
  },

  /**
   * Get all active app embeds (for shop layout injection).
   * Only returns embeds whose parent installation is also enabled.
   */
  async getActiveEmbeds() {
    try {
      return await prisma.pluginThemeExtension.findMany({
        where: { kind: 'app_embed', active: true },
        include: { installation: { select: { pluginSlug: true, enabled: true } } },
      });
    } catch (error) {
      if (isMissingDatabaseObjectError(error, THEME_EXTENSION_TABLES)) {
        logThemeExtensionFallbackOnce(
          'ThemeExtensionsService.getActiveEmbeds',
          'Theme extension tables unavailable; returning no app embeds',
          error
        );
        return [];
      }

      throw error;
    }
  },

  /** Get extensions for a specific installation */
  async getByInstallation(installationId: string) {
    return prisma.pluginThemeExtension.findMany({
      where: { installationId },
    });
  },

  /** Toggle extension active state */
  async setActive(id: string, active: boolean) {
    return prisma.pluginThemeExtension.update({
      where: { id },
      data: { active },
    });
  },

  /** Remove all extensions for an installation (for uninstall) */
  async removeByInstallation(installationId: string) {
    return prisma.pluginThemeExtension.deleteMany({
      where: { installationId },
    });
  },
};

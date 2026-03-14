'use client';

/**
 * Template Renderer
 *
 * Renders a page template by mapping block configurations to block components.
 * This is the core component that makes Theme Pack templates work.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { PageTemplate, BlockInstance, BlockSettings, ThemePackConfig } from './types';
import { getBlockComponent, mergeBlockSettings, isAppBlockType, parseAppBlockType } from './block-registry';
import { useThemePack, useThemePackOptional } from './runtime';
import { AppBlockRenderer } from './app-block-renderer';
import { getEmbeddedRendererSlug } from './rendering-mode';

interface TemplateRendererProps {
  /** Page identifier to load template for */
  page: string;
  /** Fallback content if no template is found */
  fallback?: React.ReactNode;
  /** Optional static template (bypasses loading) */
  template?: PageTemplate;
}

/**
 * Template Renderer Component
 *
 * Loads and renders a page template from the active Theme Pack.
 * Falls back to the provided fallback content if no template exists.
 */
export function TemplateRenderer({
  page,
  fallback,
  template: staticTemplate,
}: TemplateRendererProps) {
  const themePack = useThemePackOptional();
  const embeddedRendererSlug = getEmbeddedRendererSlug(themePack?.manifest);
  const [template, setTemplate] = useState<PageTemplate | null>(staticTemplate || null);
  const [isLoading, setIsLoading] = useState(!staticTemplate);

  // Load template
  useEffect(() => {
    if (staticTemplate || !themePack || embeddedRendererSlug) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function load() {
      setIsLoading(true);
      const loadedTemplate = await themePack!.loadPageTemplate(page);
      if (mounted) {
        setTemplate(loadedTemplate);
        setIsLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [page, staticTemplate, themePack, embeddedRendererSlug]);

  // If no theme pack or loading
  if (isLoading) {
    return (
      <div className="animate-pulse p-8">
        <div className="h-64 bg-gray-200 rounded-lg mb-4" />
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // If no template, render fallback
  if (!template || !template.blocks || template.blocks.length === 0) {
    return <>{fallback}</>;
  }

  // Render template blocks
  return (
    <BlocksRenderer
      blocks={template.blocks}
      themeConfig={themePack?.mergedConfig}
    />
  );
}

interface BlocksRendererProps {
  blocks: BlockInstance[];
  themeConfig?: ThemePackConfig;
}

/**
 * Blocks Renderer
 *
 * Renders an array of block instances.
 */
export function BlocksRenderer({ blocks, themeConfig }: BlocksRendererProps) {
  return (
    <div className="theme-pack-blocks">
      {blocks.map((block, index) => (
        <BlockRenderer
          key={block.id || `${block.type}-${index}`}
          block={block}
          themeConfig={themeConfig}
        />
      ))}
    </div>
  );
}

interface BlockRendererProps {
  block: BlockInstance;
  themeConfig?: ThemePackConfig;
}

/**
 * Block Renderer
 *
 * Renders a single block instance.
 */
export function BlockRenderer({ block, themeConfig }: BlockRendererProps) {
  const { type, settings, id } = block;

  // Handle app blocks from plugins (type format: "app_block:{pluginSlug}:{extensionId}")
  const appBlockInfo = useMemo(() => parseAppBlockType(type), [type]);
  if (appBlockInfo) {
    return (
      <AppBlockRenderer
        block={{
          id: id || type,
          extensionId: appBlockInfo.extensionId,
          name: appBlockInfo.extensionId,
          pluginSlug: appBlockInfo.pluginSlug,
          dataEndpoint: (settings as Record<string, unknown>)?.dataEndpoint as string | undefined,
          schema: (settings as Record<string, unknown>)?.schema as Record<string, unknown> | undefined,
        }}
        settings={settings as Record<string, unknown>}
      />
    );
  }

  // Get block from registry
  const registryEntry = useMemo(() => getBlockComponent(type), [type]);

  // If block type is not registered, show error in dev
  if (!registryEntry) {
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className="bg-red-100 border border-red-300 text-red-700 p-4 m-4 rounded">
          <p className="font-bold">Unknown Block Type</p>
          <p>Block type "{type}" is not registered in the Block Registry.</p>
          <p className="text-sm mt-2">
            Theme Packs can only use blocks from the platform's built-in Block Registry.
          </p>
        </div>
      );
    }
    // In production, silently skip unknown blocks
    return null;
  }

  // Merge settings with defaults
  const mergedSettings = mergeBlockSettings(type, settings);

  // Render the block component
  const BlockComponent = registryEntry.component;

  return (
    <BlockComponent
      settings={mergedSettings}
      themeConfig={themeConfig}
      blockId={id}
    />
  );
}

/**
 * Hook to check if a template exists for the current theme
 */
export function useHasTemplate(page: string): boolean {
  const themePack = useThemePackOptional();
  const [hasTemplate, setHasTemplate] = useState(false);

  useEffect(() => {
    if (!themePack || !themePack.activeTheme) {
      setHasTemplate(false);
      return;
    }

    // Builtin themes don't have templates
    if (themePack.activeTheme.source === 'builtin') {
      setHasTemplate(false);
      return;
    }

    // Check if template exists
    themePack.loadPageTemplate(page).then((template) => {
      setHasTemplate(!!template && !!template.blocks && template.blocks.length > 0);
    });
  }, [page, themePack]);

  return hasTemplate;
}

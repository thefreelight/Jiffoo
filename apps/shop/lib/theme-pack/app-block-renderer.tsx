'use client';

/**
 * App Block Renderer
 *
 * Fetches and renders plugin-provided App Blocks.
 * Fetches HTML from the plugin's data endpoint, sanitizes it, and renders safely.
 */

import React, { useEffect, useState } from 'react';
import { sanitizeHtml } from './html-sanitizer';

interface AppBlockData {
  id: string;
  extensionId: string;
  name: string;
  pluginSlug: string;
  dataEndpoint?: string;
  schema?: Record<string, unknown>;
}

interface AppBlockRendererProps {
  block: AppBlockData;
  settings?: Record<string, unknown>;
}

/**
 * Renders a single App Block from a plugin.
 *
 * Fetches HTML content from the block's data endpoint, sanitizes it
 * to prevent XSS, and renders the result. Shows loading skeleton
 * while fetching and error details in development mode.
 */
export function AppBlockRenderer({ block, settings }: AppBlockRendererProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!block.dataEndpoint) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchBlockData() {
      try {
        setLoading(true);
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const url = `${apiBase}${block.dataEndpoint}`;

        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...(settings
              ? { 'X-Block-Settings': btoa(JSON.stringify(settings)) }
              : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch block data: ${response.status}`);
        }

        const data = await response.json();
        const rawHtml = data.html || data.data?.html || '';

        if (mounted) {
          setHtml(sanitizeHtml(rawHtml));
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchBlockData();

    return () => {
      mounted = false;
    };
  }, [block.dataEndpoint, settings]);

  if (loading) {
    return (
      <div className="app-block-loading animate-pulse">
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className="app-block-error bg-red-50 border border-red-200 p-4 rounded text-sm text-red-700">
          <p className="font-medium">App Block Error: {block.name}</p>
          <p>{error}</p>
        </div>
      );
    }
    return null;
  }

  if (!html) return null;

  return (
    <div
      className="app-block"
      data-plugin={block.pluginSlug}
      data-extension={block.extensionId}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

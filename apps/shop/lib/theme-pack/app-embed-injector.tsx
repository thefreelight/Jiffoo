'use client';

/**
 * App Embed Injector
 *
 * Injects plugin-provided App Embeds into the page layout.
 * Supports head-end and body-end positions.
 * Embeds are non-critical; failures are silently ignored.
 */

import React, { useEffect, useState } from 'react';
import { sanitizeHtml } from './html-sanitizer';

interface AppEmbedData {
  id: string;
  extensionId: string;
  name: string;
  pluginSlug: string;
  targetPosition: string; // 'head-end' | 'body-end'
  dataEndpoint?: string;
  schema?: Record<string, unknown>;
}

interface AppEmbedInjectorProps {
  position: 'head-end' | 'body-end';
}

/**
 * Fetches and injects App Embeds for a given position.
 *
 * This component fetches the list of active embeds from the API,
 * filters by the target position, then fetches each embed's HTML
 * from its data endpoint, sanitizes it, and renders.
 */
export function AppEmbedInjector({ position }: AppEmbedInjectorProps) {
  const [embeds, setEmbeds] = useState<AppEmbedData[]>([]);
  const [embedHtml, setEmbedHtml] = useState<Record<string, string>>({});

  // Fetch active embeds from API
  useEffect(() => {
    let mounted = true;

    async function fetchEmbeds() {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const response = await fetch(
          `${apiBase}/extensions/theme-extensions/embeds`,
        );
        if (!response.ok) return;

        const data = await response.json();
        const items = data.data?.items || [];

        if (mounted) {
          setEmbeds(
            items.filter(
              (e: AppEmbedData) => e.targetPosition === position,
            ),
          );
        }
      } catch {
        // Silently fail - embeds are non-critical
      }
    }

    fetchEmbeds();
    return () => {
      mounted = false;
    };
  }, [position]);

  // Fetch HTML for each embed
  useEffect(() => {
    if (embeds.length === 0) return;
    let mounted = true;

    async function fetchEmbedData() {
      const results: Record<string, string> = {};
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

      for (const embed of embeds) {
        if (!embed.dataEndpoint) continue;

        try {
          const response = await fetch(`${apiBase}${embed.dataEndpoint}`);
          if (!response.ok) continue;

          const data = await response.json();
          const rawHtml = data.html || data.data?.html || '';
          results[embed.extensionId] = sanitizeHtml(rawHtml);
        } catch {
          // Skip failed embeds
        }
      }

      if (mounted) {
        setEmbedHtml(results);
      }
    }

    fetchEmbedData();
    return () => {
      mounted = false;
    };
  }, [embeds]);

  if (Object.keys(embedHtml).length === 0) return null;

  return (
    <>
      {embeds.map((embed) => {
        const html = embedHtml[embed.extensionId];
        if (!html) return null;

        return (
          <div
            key={embed.extensionId}
            className="app-embed"
            data-plugin={embed.pluginSlug}
            data-embed={embed.extensionId}
            data-position={position}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}

'use client';

/**
 * Locale-aware strings for plugin workspace pages. Keys resolve under
 * `merchant.plugins.workspace.*` (or any absolute namespace such as
 * `common.*`); a key missing in the current locale falls back to the English
 * text passed at the call site, with `{param}` tokens interpolated either way.
 */

import { useCallback } from 'react';
import { useT } from 'shared/src/i18n/react';

const WORKSPACE_PREFIX = 'merchant.plugins.workspace.';

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return Object.entries(params).reduce(
    (message, [key, value]) => message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    text,
  );
}

export function useWorkspaceText() {
  const t = useT();

  return useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => {
      if (!t) return interpolate(fallback, params);
      const resolvedKey = key.startsWith('common.') ? key : `${WORKSPACE_PREFIX}${key}`;
      const text = t(resolvedKey, params);
      return text === resolvedKey ? interpolate(fallback, params) : text;
    },
    [t],
  );
}

'use client';

import React from 'react';
import { registerThemeMessages, type ThemeMessageTable } from '@/lib/theme-i18n';

/**
 * Publishes the Store Localization plugin's theme translations for the
 * current locale before any theme component renders. It must stay an
 * ancestor of the themed tree: the remote runtime bundle reads the registry
 * during its first render, so the table has to be in place by then.
 */
export function ThemeMessagesRegistrar({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: ThemeMessageTable | null;
  children: React.ReactNode;
}) {
  if (messages) registerThemeMessages(locale, messages);
  return <>{children}</>;
}

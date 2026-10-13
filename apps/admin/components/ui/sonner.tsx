'use client';
import { Toaster } from 'sonner';
import type { CSSProperties } from 'react';
import { usePreferences } from '@/lib/preferences-provider';
export function AdminToaster() {
  const { mode } = usePreferences();
  return <Toaster theme={mode} position="bottom-right" style={{ '--normal-bg': 'var(--admin-core-raised)', '--normal-text': 'var(--admin-core-foreground)', '--normal-border': 'var(--admin-core-border)' } as CSSProperties} />;
}

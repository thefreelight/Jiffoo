'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';

export function Toaster(props: ComponentProps<typeof Sonner>) {
  return <Sonner position="bottom-right" {...props} style={{
    '--normal-bg': 'var(--popover)',
    '--normal-text': 'var(--popover-foreground)',
    '--normal-border': 'var(--border)',
    '--success-bg': 'var(--popover)',
    '--success-text': 'var(--shop-extras-success)',
    '--error-bg': 'var(--shop-core-destructive-soft)',
    '--error-text': 'var(--shop-core-destructive)',
    '--error-border': 'var(--shop-core-destructive-line)',
    '--border-radius': 'var(--radius)',
    ...props.style,
  } as CSSProperties} />;
}

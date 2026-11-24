'use client';

/**
 * Shared building blocks for plugin workspace pages. They follow the Merchant
 * Admin settings-page card language (white rounded card, bold title, optional
 * tinted icon chip, blue primary action) so a plugin page reads like the rest
 * of the admin instead of carrying its own visual system.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** Matches the primary header button on the Settings page. */
export const workspacePrimaryButtonClass = 'h-9 rounded-lg px-4 text-sm font-semibold';
export const workspaceOutlineButtonClass =
  'h-9 rounded-lg border-gray-100 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50';
export const workspaceInputClass =
  'h-11 rounded-xl border-gray-100 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all';
export const workspaceSelectTriggerClass =
  'h-11 rounded-xl border-gray-100 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all';
export const workspaceFieldLabelClass = 'text-[11px] font-bold uppercase tracking-wider text-gray-500';

export function WorkspaceCard(props: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  /** Right-aligned header actions (secondary buttons only — save lives in the page header). */
  actions?: ReactNode;
  /** Drop the body padding for tables and lists that bleed to the card edge. */
  flush?: boolean;
  className?: string;
  /** Omit for a header-only card (e.g. an empty state). */
  children?: ReactNode;
}) {
  const { icon, title, description, badge, actions, flush, className, children } = props;

  return (
    <section className={cn('overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm', className)}>
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-6',
          children && 'border-b border-gray-50',
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          {icon ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {badge}
            </div>
            {description ? <p className="mt-0.5 text-sm leading-6 text-gray-500">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className={flush ? undefined : 'p-5 sm:p-8'}>{children}</div> : null}
    </section>
  );
}

export function WorkspaceField(props: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { label, htmlFor, required, hint, error, className, children } = props;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor} className={workspaceFieldLabelClass}>
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs leading-5 text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-5 text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** A titled on/off row: the switch is the whole control, so no separate save is implied. */
export function WorkspaceToggleRow(props: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { id, label, description, checked, onCheckedChange, disabled, className } = props;

  return (
    <div
      className={cn(
        // Top-aligned like the fields beside it in a form grid: the switch tracks the title line.
        'flex items-start justify-between gap-6 rounded-2xl border border-gray-100 bg-gray-50/40 py-4 pl-5 pr-4',
        className,
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-semibold leading-5 text-gray-900">
          {label}
        </Label>
        {description ? <p className="mt-0.5 text-xs leading-5 text-gray-500">{description}</p> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="-mt-0.5"
      />
    </div>
  );
}

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const NOTICE_STYLES: Record<NoticeTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

/** Inline status message; use for outcomes the merchant must see, not for resting state. */
export function WorkspaceNotice(props: { tone?: NoticeTone; children: ReactNode; className?: string }) {
  const { tone = 'info', children, className } = props;

  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm leading-6', NOTICE_STYLES[tone], className)} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

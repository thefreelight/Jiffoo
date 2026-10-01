'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Blocks, Palette, ShieldCheck, Sparkles, Languages, Puzzle } from 'lucide-react';

type ExtensionKind = 'plugin' | 'theme';

interface ExtensionAvatarProps {
  slug: string;
  name: string;
  kind: ExtensionKind;
  thumbnailUrl?: string | null;
  className?: string;
}

function resolveExtensionPalette(slug: string, kind: ExtensionKind) {
  if (kind === 'theme') {
    if (slug === 'yevbi') {
      return {
        icon: Palette,
        shell: 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 text-white shadow-indigo-500/20',
      };
    }

    if (slug === 'esim-mall') {
      return {
        icon: Sparkles,
        shell: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-emerald-500/20',
      };
    }

    return {
      icon: Palette,
      shell: 'bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-slate-500/10',
    };
  }

  if (slug === 'stripe') {
    return {
      icon: StripeMark,
      shell: 'bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white shadow-violet-500/20',
    };
  }

  if (slug === 'i18n') {
    return {
      icon: Languages,
      shell: 'bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 text-white shadow-orange-500/20',
    };
  }

  if (slug === 'odoo') {
    return {
      icon: OdooMark,
      shell: 'bg-gradient-to-br from-emerald-500 via-green-500 to-lime-500 text-white shadow-emerald-500/20',
    };
  }

  return {
    icon: Blocks,
    shell: 'bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 text-white shadow-blue-500/20',
  };
}

function StripeMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
    <path d="M6 7.25c1.5-1.45 3.55-2.2 6.1-2.2 2.25 0 4.25.55 5.9 1.65v3.05c-1.5-.95-3.2-1.45-5.15-1.45-1.3 0-2.15.28-2.15.78 0 .45.55.63 2.6.9 3.25.42 5.1 1.45 5.1 4.45 0 2.8-2.3 4.65-6.05 4.65-2.55 0-4.7-.62-6.35-1.85v-3.25c1.75 1.2 3.8 1.85 6.1 1.85 1.45 0 2.25-.35 2.25-.92 0-.5-.62-.7-2.7-.98C8.35 13.58 6 12.45 6 9.6c0-.85.2-1.65.6-2.35Z" fill="currentColor" />
  </svg>;
}

function OdooMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
    <circle cx="8" cy="8" r="3.2" fill="currentColor" opacity=".98" />
    <circle cx="16" cy="8" r="3.2" fill="currentColor" opacity=".8" />
    <circle cx="8" cy="16" r="3.2" fill="currentColor" opacity=".8" />
    <circle cx="16" cy="16" r="3.2" fill="currentColor" opacity=".98" />
    <path d="M8 11.2v1.6M16 11.2v1.6M11.2 8h1.6M11.2 16h1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>;
}

export function ExtensionAvatar({
  slug,
  name,
  kind,
  thumbnailUrl,
  className,
}: ExtensionAvatarProps) {
  const palette = resolveExtensionPalette(slug, kind);
  const Icon = palette.icon;

  if (thumbnailUrl) {
    return (
      <div className={cn('relative overflow-hidden rounded-2xl border border-white/60 bg-white shadow-sm', className)}>
        <Image
          src={thumbnailUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl shadow-lg',
        palette.shell,
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

interface OfficialBadgeProps {
  className?: string;
  compact?: boolean;
}

export function OfficialBadge({ className, compact = false }: OfficialBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 rounded-full border-blue-200 bg-blue-50 text-blue-700',
        compact ? 'px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]' : 'px-2.5 py-1 text-[11px] font-semibold',
        className
      )}
    >
      <ShieldCheck className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      Official
    </Badge>
  );
}

export function InstalledPluginBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 rounded-full border-slate-200 bg-slate-50 text-slate-600 px-2.5 py-1 text-[11px] font-semibold', className)}
    >
      <Puzzle className="h-3.5 w-3.5" />
      Installed
    </Badge>
  );
}

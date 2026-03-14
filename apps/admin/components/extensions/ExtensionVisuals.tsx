'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Blocks, Palette, ShieldCheck, Sparkles, Languages, CreditCard, DatabaseZap, Puzzle } from 'lucide-react';

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
      icon: CreditCard,
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
      icon: DatabaseZap,
      shell: 'bg-gradient-to-br from-emerald-500 via-green-500 to-lime-500 text-white shadow-emerald-500/20',
    };
  }

  return {
    icon: Blocks,
    shell: 'bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 text-white shadow-blue-500/20',
  };
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

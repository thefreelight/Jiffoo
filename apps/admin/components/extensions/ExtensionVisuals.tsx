'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Blocks, Puzzle } from 'lucide-react';

interface ExtensionAvatarProps {
  slug: string;
  name: string;
  thumbnailUrl?: string | null;
  className?: string;
}

function resolveExtensionPalette() {
  return {
    icon: Blocks,
    shell: 'bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 text-white shadow-blue-500/20',
  };
}

export function ExtensionAvatar({
  slug,
  name,
  thumbnailUrl,
  className,
}: ExtensionAvatarProps) {
  const palette = resolveExtensionPalette();
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

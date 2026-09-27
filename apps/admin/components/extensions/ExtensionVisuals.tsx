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
    shell: 'bg-gradient-to-br from-action-strong via-chart-cyan-base to-chart-teal-light text-surface shadow-action-base/20',
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
      <div className={cn('relative overflow-hidden rounded-2xl border border-surface/60 bg-surface shadow-sm', className)}>
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
      className={cn('gap-1.5 rounded-full border-cool-soft bg-cool-veil text-cool-strong px-2.5 py-1 text-[11px] font-semibold', className)}
    >
      <Puzzle className="h-3.5 w-3.5" />
      Installed
    </Badge>
  );
}

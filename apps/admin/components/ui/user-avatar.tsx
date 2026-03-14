'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getAvatarFallbackText, resolveAvatarSrc } from '@/lib/avatar';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  username?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  textClassName?: string;
}

export function UserAvatar({
  src,
  name,
  username,
  alt,
  className,
  imageClassName,
  fallbackClassName,
  textClassName,
}: UserAvatarProps) {
  const resolvedSrc = useMemo(() => resolveAvatarSrc(src), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  const fallbackText = getAvatarFallbackText(name, username);
  const imageAlt = alt || name || username || 'User';

  return (
    <div className={cn('overflow-hidden', className)}>
      {resolvedSrc && !failed ? (
        <img
          src={resolvedSrc}
          alt={imageAlt}
          className={cn('h-full w-full object-cover', imageClassName)}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center bg-blue-50 text-blue-600',
            fallbackClassName,
          )}
          aria-label={imageAlt}
        >
          <span className={cn('font-bold uppercase', textClassName)}>{fallbackText}</span>
        </div>
      )}
    </div>
  );
}

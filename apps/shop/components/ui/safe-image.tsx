'use client';

import * as React from 'react';
import Image from 'next/image';
import { ShoppingBag, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  fallbackIcon?: React.ReactNode;
  fallbackClassName?: string;
  showLoadingState?: boolean;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoad?: () => void;
  [key: string]: unknown;
}

export function SafeImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
  fallbackIcon,
  fallbackClassName,
  showLoadingState = true,
  onError,
  onLoad,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Check if image URL is valid
  const isValidImageUrl = (url?: string | null): boolean => {
    if (!url || url === '' || url === '[]' || url.startsWith('[')) {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      // If not a full URL, check if it's a relative path
      return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoading(false);

    // Log image load failure (development environment)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SafeImage] Failed to load image: ${src}`, { alt });
    }

    onError?.(e);
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  // Reset status when src changes
  React.useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const shouldShowFallback = !isValidImageUrl(src) || hasError;

  // Placeholder/fallback state
  if (shouldShowFallback) {
    return (
      <div
        className={cn(
          "bg-gray-200 dark:bg-gray-700 flex items-center justify-center",
          fallbackClassName,
          className
        )}
        style={fill ? undefined : { width, height }}
        role="img"
        aria-label={alt}
      >
        {fallbackIcon || (hasError ? (
          <ImageOff className="h-6 w-6 text-gray-400" />
        ) : (
          <ShoppingBag className="h-6 w-6 text-gray-400" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("relative", fill ? "w-full h-full" : "")} style={!fill ? { width, height } : undefined}>
      {/* Loading state skeleton */}
      {showLoadingState && isLoading && (
        <div
          className={cn(
            "absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse",
            className
          )}
        />
      )}
      <Image
        src={src!}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={cn(
          className,
          isLoading && showLoadingState ? 'opacity-0' : 'opacity-100',
          'transition-opacity duration-200'
        )}
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      />
    </div>
  );
}
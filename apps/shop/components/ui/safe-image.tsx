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

  // 检查图片URL是否有效
  const isValidImageUrl = (url?: string | null): boolean => {
    if (!url || url === '' || url === '[]' || url.startsWith('[')) {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      // 如果不是完整URL，检查是否是相对路径
      return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    setIsLoading(false);

    // 记录图片加载失败（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SafeImage] Failed to load image: ${src}`, { alt });
    }

    onError?.(e);
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  // 重置状态当src改变时
  React.useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const shouldShowFallback = !isValidImageUrl(src) || hasError;

  // 占位/回退状态
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
      {/* 加载状态骨架屏 */}
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
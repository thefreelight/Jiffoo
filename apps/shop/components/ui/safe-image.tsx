'use client';

import * as React from 'react';
import Image from 'next/image';
import { ShoppingBag } from 'lucide-react';
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
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
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
  onError,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = React.useState(false);

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
    onError?.(e);
  };

  // 重置错误状态当src改变时
  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  const shouldShowFallback = !isValidImageUrl(src) || hasError;

  if (shouldShowFallback) {
    return (
      <div 
        className={cn(
          "bg-gray-200 dark:bg-gray-700 flex items-center justify-center",
          fallbackClassName,
          className
        )}
        style={fill ? undefined : { width, height }}
      >
        {fallbackIcon || <ShoppingBag className="h-6 w-6 text-gray-400" />}
      </div>
    );
  }

  return (
    <Image
      src={src!}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      className={className}
      onError={handleError}
      {...props}
    />
  );
} 
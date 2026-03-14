'use client';

import * as React from 'react';
import { SafeImage } from './safe-image';

interface LazyImageProps {
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
  rootMargin?: string;
  threshold?: number;
  [key: string]: unknown;
}

export function LazyImage({
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
  rootMargin = '50px',
  threshold = 0.01,
  ...props
}: LazyImageProps) {
  const [isInView, setIsInView] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // If IntersectionObserver is not supported, load immediately
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            setShouldLoad(true);
            // Once the image is in view and loading, we can disconnect
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return (
    <div ref={containerRef} className={fill ? "w-full h-full" : ""} style={!fill ? { width, height } : undefined}>
      {shouldLoad ? (
        <SafeImage
          src={src}
          alt={alt}
          fill={fill}
          width={width}
          height={height}
          className={className}
          fallbackIcon={fallbackIcon}
          fallbackClassName={fallbackClassName}
          showLoadingState={showLoadingState}
          onError={onError}
          onLoad={onLoad}
          {...props}
        />
      ) : (
        <div
          className={className}
          style={{
            width: fill ? '100%' : width,
            height: fill ? '100%' : height,
            backgroundColor: 'transparent',
          }}
          aria-label={`Loading ${alt}`}
        />
      )}
    </div>
  );
}

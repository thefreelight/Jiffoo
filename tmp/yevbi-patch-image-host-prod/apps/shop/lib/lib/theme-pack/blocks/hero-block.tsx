'use client';

/**
 * Hero Block
 *
 * A large hero banner with headline, subtitle, and call-to-action.
 * This is a built-in block that Theme Packs can use in their templates.
 */

import React from 'react';
import Link from 'next/link';
import type { BlockComponentProps } from '../types';
import { useThemePackOptional } from '../runtime';

interface HeroSettings {
  /** Main headline text */
  headline?: string;
  /** Subtitle/subheadline text */
  subtitle?: string;
  /** Call-to-action button text */
  ctaText?: string;
  /** Call-to-action button link */
  ctaHref?: string;
  /** Background image URL (relative to theme assets or absolute) */
  backgroundImage?: string;
  /** Image path shorthand (will be resolved via theme assets) */
  image?: string;
  /** Overlay opacity (0-1) */
  overlayOpacity?: number;
  /** Text alignment: 'left' | 'center' | 'right' */
  textAlign?: 'left' | 'center' | 'right';
  /** Height variant: 'small' | 'medium' | 'large' | 'full' */
  height?: 'small' | 'medium' | 'large' | 'full';
  /** Background color (fallback when no image) */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Secondary CTA text */
  secondaryCtaText?: string;
  /** Secondary CTA link */
  secondaryCtaHref?: string;
}

export function HeroBlock({ settings, themeConfig, blockId }: BlockComponentProps) {
  const themePack = useThemePackOptional();
  const heroSettings = settings as HeroSettings;

  const {
    headline = 'Welcome to Our Store',
    subtitle = 'Discover amazing products at great prices',
    ctaText = 'Shop Now',
    ctaHref = '/products',
    backgroundImage,
    image,
    overlayOpacity = 0.4,
    textAlign = 'center',
    height = 'large',
    backgroundColor,
    textColor,
    secondaryCtaText,
    secondaryCtaHref,
  } = heroSettings;

  // Resolve image URL
  const resolvedImage = React.useMemo(() => {
    const imgPath = backgroundImage || image;
    if (!imgPath) return null;
    if (themePack) {
      return themePack.resolveAsset(imgPath);
    }
    return imgPath;
  }, [backgroundImage, image, themePack]);

  // Height classes
  const heightClasses: Record<string, string> = {
    small: 'min-h-[300px]',
    medium: 'min-h-[400px]',
    large: 'min-h-[500px]',
    full: 'min-h-screen',
  };

  // Alignment classes
  const alignClasses: Record<string, string> = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  };

  const primaryColor = themeConfig?.colors?.primary || 'var(--theme-color-primary, #2563eb)';

  return (
    <section
      id={blockId}
      className={`relative flex flex-col justify-center ${heightClasses[height]} ${alignClasses[textAlign]} w-full overflow-hidden`}
      style={{
        backgroundColor: backgroundColor || 'var(--theme-color-background, #f8fafc)',
        color: textColor || 'inherit',
      }}
    >
      {/* Background Image */}
      {resolvedImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${resolvedImage})` }}
          />
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: overlayOpacity }}
          />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-16">
        <div className={`max-w-3xl mx-auto ${textAlign === 'center' ? '' : textAlign === 'left' ? 'mr-auto ml-0' : 'ml-auto mr-0'}`}>
          {headline && (
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
              style={{ color: resolvedImage ? '#ffffff' : textColor || 'inherit' }}
            >
              {headline}
            </h1>
          )}

          {subtitle && (
            <p
              className="text-lg md:text-xl mb-8 opacity-90"
              style={{ color: resolvedImage ? '#ffffff' : textColor || 'inherit' }}
            >
              {subtitle}
            </p>
          )}

          {/* CTAs */}
          <div className={`flex gap-4 ${textAlign === 'center' ? 'justify-center' : textAlign === 'left' ? 'justify-start' : 'justify-end'}`}>
            {ctaText && ctaHref && (
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-colors hover:opacity-90"
                style={{
                  backgroundColor: primaryColor,
                  color: '#ffffff',
                }}
              >
                {ctaText}
              </Link>
            )}

            {secondaryCtaText && secondaryCtaHref && (
              <Link
                href={secondaryCtaHref}
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-colors border-2"
                style={{
                  borderColor: resolvedImage ? '#ffffff' : primaryColor,
                  color: resolvedImage ? '#ffffff' : primaryColor,
                  backgroundColor: 'transparent',
                }}
              >
                {secondaryCtaText}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

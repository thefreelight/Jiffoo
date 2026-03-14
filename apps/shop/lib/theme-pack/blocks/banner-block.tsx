'use client';

/**
 * Banner Block
 *
 * A promotional banner with image and text.
 */

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { BlockComponentProps } from '../types';
import { useThemePackOptional } from '../runtime';

interface BannerSettings {
  /** Banner image URL */
  image?: string;
  /** Banner title */
  title?: string;
  /** Banner subtitle */
  subtitle?: string;
  /** Link URL */
  link?: string;
  /** Content position: 'left' | 'center' | 'right' */
  position?: 'left' | 'center' | 'right';
  /** Text color */
  textColor?: string;
  /** Background color (fallback) */
  backgroundColor?: string;
  /** Banner height */
  height?: 'small' | 'medium' | 'large';
  /** CTA button text */
  ctaText?: string;
}

export function BannerBlock({ settings, themeConfig, blockId }: BlockComponentProps) {
  const themePack = useThemePackOptional();
  const bannerSettings = settings as BannerSettings;

  const {
    image,
    title,
    subtitle,
    link,
    position = 'center',
    textColor = '#ffffff',
    backgroundColor = '#1f2937',
    height = 'medium',
    ctaText,
  } = bannerSettings;

  // Resolve image URL
  const resolvedImage = React.useMemo(() => {
    if (!image) return null;
    if (themePack) {
      return themePack.resolveAsset(image);
    }
    return image;
  }, [image, themePack]);

  const heightClasses: Record<string, string> = {
    small: 'h-[200px]',
    medium: 'h-[300px]',
    large: 'h-[400px]',
  };

  const positionClasses: Record<string, string> = {
    left: 'justify-start text-left',
    center: 'justify-center text-center',
    right: 'justify-end text-right',
  };

  const primaryColor = themeConfig?.colors?.primary || 'var(--theme-color-primary, #2563eb)';

  const content = (
    <div
      id={blockId}
      className={`relative ${heightClasses[height]} flex items-center overflow-hidden`}
      style={{ backgroundColor }}
    >
      {/* Background Image */}
      {resolvedImage && (
        <Image
          src={resolvedImage}
          alt={title || 'Banner'}
          fill
          className="object-cover"
        />
      )}

      {/* Content Overlay */}
      <div className={`relative z-10 container mx-auto px-4 flex ${positionClasses[position]}`}>
        <div className="max-w-xl">
          {title && (
            <h2
              className="text-2xl md:text-3xl font-bold mb-2"
              style={{ color: textColor }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              className="text-lg opacity-90 mb-4"
              style={{ color: textColor }}
            >
              {subtitle}
            </p>
          )}
          {ctaText && link && (
            <span
              className="inline-block px-6 py-2 rounded font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor, color: '#ffffff' }}
            >
              {ctaText}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }

  return content;
}

/**
 * SEO Head Component
 *
 * Renders meta tags, OpenGraph data, and structured data for SEO optimization.
 * Designed to work with Next.js 13+ Metadata API and provide utility functions
 * for generating metadata objects.
 */

import type { Metadata } from 'next';
import type { MetaTags } from '@/lib/seo-utils';

interface SeoHeadProps {
  /** Meta tags data */
  metaTags: MetaTags;
  /** Additional metadata options */
  options?: {
    /** Site name for branding */
    siteName?: string;
    /** Locale for the page */
    locale?: string;
    /** Alternative locales */
    alternateLocales?: string[];
  };
}

/**
 * Generate Next.js Metadata object from MetaTags
 *
 * This function converts MetaTags to a Metadata object compatible
 * with Next.js 13+ Metadata API for server-side rendering.
 *
 * @param metaTags - Meta tags data
 * @param options - Additional metadata options
 * @returns Next.js Metadata object
 */
export function generateMetadata(
  metaTags: MetaTags,
  options?: SeoHeadProps['options']
): Metadata {
  const {
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    ogUrl,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
  } = metaTags;

  const metadata: Metadata = {
    title,
    description,
  };

  // Add canonical URL
  if (canonical) {
    metadata.alternates = {
      canonical,
    };
  }

  // Add OpenGraph metadata
  if (ogTitle || ogDescription || ogImage || ogType || ogUrl) {
    metadata.openGraph = {
      title: ogTitle || title,
      description: ogDescription || description,
      url: ogUrl || canonical,
      siteName: options?.siteName || 'Jiffoo Mall',
      locale: options?.locale || 'en_US',
      type: (ogType as 'website' | 'article') || 'website',
      ...(ogImage && {
        images: [
          {
            url: ogImage,
            alt: ogTitle || title,
          },
        ],
      }),
    };
  }

  // Add Twitter Card metadata
  if (twitterCard || twitterTitle || twitterDescription || twitterImage) {
    metadata.twitter = {
      card: (twitterCard as 'summary' | 'summary_large_image' | 'app' | 'player') || 'summary',
      title: twitterTitle || title,
      description: twitterDescription || description,
      ...(twitterImage && {
        images: [twitterImage],
      }),
    };
  }

  return metadata;
}

/**
 * Generate meta tags array for rendering
 *
 * This function generates an array of meta tag objects that can be
 * rendered as HTML meta tags. Useful for client-side dynamic updates
 * or custom rendering scenarios.
 *
 * @param metaTags - Meta tags data
 * @returns Array of meta tag objects
 */
export function generateMetaTagsArray(metaTags: MetaTags): Array<{
  property?: string;
  name?: string;
  content: string;
}> {
  const tags: Array<{ property?: string; name?: string; content: string }> = [];

  const {
    description,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    ogUrl,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
  } = metaTags;

  // Standard meta tags
  if (description) {
    tags.push({ name: 'description', content: description });
  }

  // OpenGraph tags
  if (ogTitle) {
    tags.push({ property: 'og:title', content: ogTitle });
  }
  if (ogDescription) {
    tags.push({ property: 'og:description', content: ogDescription });
  }
  if (ogImage) {
    tags.push({ property: 'og:image', content: ogImage });
  }
  if (ogType) {
    tags.push({ property: 'og:type', content: ogType });
  }
  if (ogUrl) {
    tags.push({ property: 'og:url', content: ogUrl });
  }

  // Twitter Card tags
  if (twitterCard) {
    tags.push({ name: 'twitter:card', content: twitterCard });
  }
  if (twitterTitle) {
    tags.push({ name: 'twitter:title', content: twitterTitle });
  }
  if (twitterDescription) {
    tags.push({ name: 'twitter:description', content: twitterDescription });
  }
  if (twitterImage) {
    tags.push({ name: 'twitter:image', content: twitterImage });
  }

  return tags;
}

/**
 * Generate link tags for canonical and alternate URLs
 *
 * @param canonical - Canonical URL
 * @param alternates - Alternate URLs by locale
 * @returns Array of link tag objects
 */
export function generateLinkTags(
  canonical?: string,
  alternates?: Record<string, string>
): Array<{
  rel: string;
  href: string;
  hreflang?: string;
}> {
  const links: Array<{ rel: string; href: string; hreflang?: string }> = [];

  // Canonical link
  if (canonical) {
    links.push({ rel: 'canonical', href: canonical });
  }

  // Alternate language links
  if (alternates) {
    Object.entries(alternates).forEach(([locale, url]) => {
      links.push({ rel: 'alternate', href: url, hreflang: locale });
    });
  }

  return links;
}

/**
 * Validate meta tags for common SEO issues
 *
 * @param metaTags - Meta tags to validate
 * @returns Validation result with warnings
 */
export function validateMetaTags(metaTags: MetaTags): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check title length
  if (metaTags.title.length < 30) {
    warnings.push('Title is too short (recommended: 30-60 characters)');
  }
  if (metaTags.title.length > 60) {
    warnings.push('Title is too long (recommended: 30-60 characters)');
  }

  // Check description length
  if (metaTags.description.length < 120) {
    warnings.push('Description is too short (recommended: 120-160 characters)');
  }
  if (metaTags.description.length > 160) {
    warnings.push('Description is too long (recommended: 120-160 characters)');
  }

  // Check for missing OpenGraph data
  if (!metaTags.ogTitle) {
    warnings.push('Missing OpenGraph title (og:title)');
  }
  if (!metaTags.ogDescription) {
    warnings.push('Missing OpenGraph description (og:description)');
  }
  if (!metaTags.ogImage) {
    warnings.push('Missing OpenGraph image (og:image)');
  }

  // Check for missing Twitter Card data
  if (!metaTags.twitterCard) {
    warnings.push('Missing Twitter Card type (twitter:card)');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * SeoHead Component
 *
 * A helper component that provides SEO utilities and metadata generation.
 * In Next.js 13+, this component doesn't render anything but provides
 * functions to generate metadata for the Metadata API.
 *
 * @example
 * ```tsx
 * // In a page.tsx file:
 * import { generateMetadata } from '@/components/seo/SeoHead';
 * import { generateProductMetaTags } from '@/lib/seo-utils';
 *
 * export async function generateMetadata({ params }) {
 *   const product = await fetchProduct(params.id);
 *   const metaTags = generateProductMetaTags({
 *     name: product.name,
 *     description: product.description,
 *     slug: product.slug,
 *     imageUrl: product.imageUrl,
 *     price: product.price,
 *     seoMetadata: product.seoMetadata,
 *   });
 *   return generateMetadata(metaTags);
 * }
 * ```
 */
export function SeoHead({ metaTags, options }: SeoHeadProps) {
  // This component is primarily used for its utility functions
  // In Next.js 13+, metadata is handled by the Metadata API
  // This component returns null as it's not meant to render anything
  return null;
}

export default SeoHead;

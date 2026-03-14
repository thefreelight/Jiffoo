/**
 * SEO Utilities
 *
 * Utilities for generating meta tags, canonical URLs, and structured data
 * for the shop frontend.
 */

export interface SeoMetadata {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  structuredData?: string | Record<string, unknown> | null; // JSON string or object
}

export interface MetaTags {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

export interface ProductMetaOptions {
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  seoMetadata?: SeoMetadata;
}

export interface CategoryMetaOptions {
  name: string;
  description?: string;
  slug: string;
  seoMetadata?: SeoMetadata;
}

/**
 * Generate canonical URL for a page
 * @param path - The path of the page (e.g., '/products/my-product')
 * @param baseUrl - The base URL of the site
 */
export function generateCanonicalUrl(path: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3003';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Generate meta tags for a product
 * @param options - Product meta options
 */
export function generateProductMetaTags(options: ProductMetaOptions): MetaTags {
  const {
    name,
    description = '',
    slug,
    imageUrl,
    price,
    currency = 'USD',
    seoMetadata,
  } = options;

  const title = seoMetadata?.metaTitle || name;
  const desc = seoMetadata?.metaDescription || description;
  const canonical = seoMetadata?.canonicalUrl || generateCanonicalUrl(`/products/${slug}`);

  return {
    title,
    description: desc,
    canonical,
    ogTitle: title,
    ogDescription: desc,
    ogImage: imageUrl,
    ogType: 'website',
    ogUrl: canonical,
    twitterCard: imageUrl ? 'summary_large_image' : 'summary',
    twitterTitle: title,
    twitterDescription: desc,
    twitterImage: imageUrl,
  };
}

/**
 * Generate meta tags for a category
 * @param options - Category meta options
 */
export function generateCategoryMetaTags(options: CategoryMetaOptions): MetaTags {
  const { name, description = '', slug, seoMetadata } = options;

  const title = seoMetadata?.metaTitle || name;
  const desc = seoMetadata?.metaDescription || description;
  const canonical = seoMetadata?.canonicalUrl || generateCanonicalUrl(`/categories/${slug}`);

  return {
    title,
    description: desc,
    canonical,
    ogTitle: title,
    ogDescription: desc,
    ogType: 'website',
    ogUrl: canonical,
    twitterCard: 'summary',
    twitterTitle: title,
    twitterDescription: desc,
  };
}

/**
 * Generate default meta tags for a page
 * @param title - Page title
 * @param description - Page description
 * @param path - Page path (optional)
 */
export function generateDefaultMetaTags(
  title: string,
  description: string,
  path?: string
): MetaTags {
  return {
    title,
    description,
    canonical: path ? generateCanonicalUrl(path) : undefined,
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    ogUrl: path ? generateCanonicalUrl(path) : undefined,
    twitterCard: 'summary',
    twitterTitle: title,
    twitterDescription: description,
  };
}

/**
 * Generate product structured data (JSON-LD)
 * @param product - Product data
 */
export function generateProductStructuredData(product: {
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  sku?: string;
  rating?: {
    value: number;
    count: number;
  };
}): string {
  const {
    name,
    description = '',
    slug,
    imageUrl,
    price,
    currency = 'USD',
    availability = 'InStock',
    brand,
    sku,
    rating,
  } = product;

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url: generateCanonicalUrl(`/products/${slug}`),
  };

  if (imageUrl) {
    structuredData.image = imageUrl;
  }

  if (brand) {
    structuredData.brand = {
      '@type': 'Brand',
      name: brand,
    };
  }

  if (sku) {
    structuredData.sku = sku;
  }

  if (price !== undefined) {
    structuredData.offers = {
      '@type': 'Offer',
      price: price.toString(),
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
    };
  }

  if (rating) {
    structuredData.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.value,
      reviewCount: rating.count,
    };
  }

  return JSON.stringify(structuredData);
}

/**
 * Generate breadcrumb structured data (JSON-LD)
 * @param items - Breadcrumb items
 */
export function generateBreadcrumbStructuredData(
  items: Array<{ name: string; url: string }>
): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return JSON.stringify(structuredData);
}

/**
 * Parse structured data JSON string safely
 * @param jsonString - JSON string to parse
 */
export function parseStructuredData(input?: string | Record<string, unknown> | null): Record<string, unknown> | null {
  if (!input) return null;
  if (typeof input === 'object' && !Array.isArray(input)) {
    return input;
  }
  if (typeof input !== 'string') return null;

  try {
    const data = JSON.parse(input);
    if (typeof data === 'object' && data !== null) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate SEO metadata
 * @param metadata - SEO metadata to validate
 */
export function validateSeoMetadata(metadata: SeoMetadata): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate meta title length
  if (metadata.metaTitle) {
    if (metadata.metaTitle.length < 10) {
      errors.push('Meta title is too short (minimum 10 characters)');
    }
    if (metadata.metaTitle.length > 70) {
      errors.push('Meta title is too long (maximum 70 characters)');
    }
  }

  // Validate meta description length
  if (metadata.metaDescription) {
    if (metadata.metaDescription.length < 50) {
      errors.push('Meta description is too short (minimum 50 characters)');
    }
    if (metadata.metaDescription.length > 200) {
      errors.push('Meta description is too long (maximum 200 characters)');
    }
  }

  // Validate canonical URL format
  if (metadata.canonicalUrl) {
    try {
      new URL(metadata.canonicalUrl);
    } catch {
      errors.push('Canonical URL is not a valid URL');
    }
  }

  // Validate structured data JSON
  if (metadata.structuredData) {
    const parsed = parseStructuredData(metadata.structuredData);
    if (!parsed) {
      errors.push('Structured data is not valid JSON');
    } else if (!parsed['@context'] || !parsed['@type']) {
      errors.push('Structured data must include @context and @type properties');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Truncate text for meta descriptions
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 160)
 */
export function truncateForMeta(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;

  // Find the last space before maxLength to avoid cutting words
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Generate meta title with site name suffix
 * @param title - Page title
 * @param siteName - Site name (optional)
 */
export function generateMetaTitle(title: string, siteName?: string): string {
  const site = siteName || 'Jiffoo Mall';

  if (title.includes(site)) {
    return title;
  }

  return `${title} | ${site}`;
}

/**
 * Extract keywords from text for SEO
 * @param text - Text to extract keywords from
 * @param maxKeywords - Maximum number of keywords (default 10)
 */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
  // Remove special characters and convert to lowercase
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, '');

  // Split into words
  const words = cleaned.split(/\s+/);

  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'we', 'you', 'your', 'this', 'these',
  ]);

  // Filter out stop words and short words
  const filtered = words.filter(
    (word) => word.length > 3 && !stopWords.has(word)
  );

  // Count word frequency
  const frequency = new Map<string, number>();
  filtered.forEach((word) => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });

  // Sort by frequency and return top keywords
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

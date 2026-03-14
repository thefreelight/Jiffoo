/**
 * StructuredData Component
 *
 * Renders JSON-LD structured data for SEO optimization.
 * Supports product schema, breadcrumbs, and custom structured data.
 */

'use client';

import * as React from 'react';

interface StructuredDataProps {
  /** Structured data as JSON string or object */
  data: string | Record<string, unknown>;
  /** Optional ID for the script tag */
  id?: string;
  /** Optional type override (defaults to 'application/ld+json') */
  type?: string;
}

/**
 * Validate structured data object
 *
 * @param data - Structured data object
 * @returns Validation result
 */
function validateStructuredData(data: Record<string, unknown>): {
  valid: boolean;
  error?: string;
} {
  // Check for required @context property
  if (!data['@context']) {
    return {
      valid: false,
      error: 'Structured data must include @context property',
    };
  }

  // Check for required @type property
  if (!data['@type']) {
    return {
      valid: false,
      error: 'Structured data must include @type property',
    };
  }

  // Validate @context is a valid schema.org URL
  const context = data['@context'];
  if (
    typeof context === 'string' &&
    !context.startsWith('https://schema.org') &&
    !context.startsWith('http://schema.org')
  ) {
    return {
      valid: false,
      error: '@context must be a schema.org URL',
    };
  }

  return { valid: true };
}

/**
 * Parse and validate structured data
 *
 * @param data - Structured data as string or object
 * @returns Parsed and validated data, or null if invalid
 */
function parseAndValidate(
  data: string | Record<string, unknown>
): string | null {
  try {
    // If data is a string, parse it
    const parsedData =
      typeof data === 'string' ? JSON.parse(data) : data;

    // Validate the parsed data
    if (typeof parsedData !== 'object' || parsedData === null) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[StructuredData] Invalid structured data: must be an object');
      }
      return null;
    }

    const validation = validateStructuredData(parsedData);
    if (!validation.valid) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[StructuredData] ${validation.error}`);
      }
      return null;
    }

    // Return stringified JSON
    return JSON.stringify(parsedData);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[StructuredData] Failed to parse structured data:', error);
    }
    return null;
  }
}

/**
 * StructuredData Component
 *
 * Renders JSON-LD structured data in a script tag for SEO purposes.
 * Validates data before rendering to ensure proper schema.org format.
 *
 * @example
 * ```tsx
 * import { StructuredData } from '@/components/seo/StructuredData';
 * import { generateProductStructuredData } from '@/lib/seo-utils';
 *
 * // Using with generated structured data
 * const productSchema = generateProductStructuredData({
 *   name: 'Product Name',
 *   description: 'Product description',
 *   slug: 'product-slug',
 *   imageUrl: 'https://example.com/image.jpg',
 *   price: 99.99,
 *   currency: 'USD',
 * });
 *
 * <StructuredData data={productSchema} />
 *
 * // Using with custom object
 * <StructuredData
 *   data={{
 *     '@context': 'https://schema.org',
 *     '@type': 'Product',
 *     name: 'Product Name',
 *   }}
 * />
 * ```
 */
export function StructuredData({
  data,
  id,
  type = 'application/ld+json',
}: StructuredDataProps) {
  // Parse and validate the data
  const jsonLd = React.useMemo(() => parseAndValidate(data), [data]);

  // Don't render if data is invalid
  if (!jsonLd) {
    return null;
  }

  return (
    <script
      id={id}
      type={type}
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}

/**
 * Helper function to combine multiple structured data schemas
 *
 * @param schemas - Array of structured data objects or strings
 * @returns Combined structured data as JSON string
 *
 * @example
 * ```tsx
 * import { combineStructuredData } from '@/components/seo/StructuredData';
 *
 * const combined = combineStructuredData([
 *   generateProductStructuredData(product),
 *   generateBreadcrumbStructuredData(breadcrumbs),
 * ]);
 *
 * <StructuredData data={combined} />
 * ```
 */
export function combineStructuredData(
  schemas: Array<string | Record<string, unknown>>
): string {
  const parsedSchemas = schemas
    .map((schema) => {
      try {
        return typeof schema === 'string' ? JSON.parse(schema) : schema;
      } catch {
        return null;
      }
    })
    .filter((schema): schema is Record<string, unknown> => schema !== null);

  if (parsedSchemas.length === 0) {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [],
    });
  }

  if (parsedSchemas.length === 1) {
    return JSON.stringify(parsedSchemas[0]);
  }

  // Multiple schemas: use @graph
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': parsedSchemas,
  });
}

/**
 * StructuredDataList Component
 *
 * Renders multiple structured data schemas in a single script tag.
 * Automatically combines schemas using @graph notation.
 *
 * @example
 * ```tsx
 * import { StructuredDataList } from '@/components/seo/StructuredData';
 *
 * <StructuredDataList
 *   schemas={[
 *     generateProductStructuredData(product),
 *     generateBreadcrumbStructuredData(breadcrumbs),
 *   ]}
 * />
 * ```
 */
export function StructuredDataList({
  schemas,
  id,
}: {
  schemas: Array<string | Record<string, unknown>>;
  id?: string;
}) {
  const combinedData = React.useMemo(
    () => combineStructuredData(schemas),
    [schemas]
  );

  return <StructuredData data={combinedData} id={id} />;
}

export default StructuredData;

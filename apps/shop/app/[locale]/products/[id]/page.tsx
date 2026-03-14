/**
 * Product Detail Page for Shop Application
 *
 * Server component that generates SEO metadata and structured data.
 * Renders ProductDetailClient for interactive functionality.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductService } from '@/services/product.service';
import { generateProductMetaTags, generateProductStructuredData } from '@/lib/seo-utils';
import { generateMetadata as generateSeoMetadata } from '@/components/seo/SeoHead';
import ProductDetailClient from './ProductDetailClient';

interface ProductPageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

/**
 * Generate metadata for the product detail page
 * This function is called by Next.js to generate <head> tags
 */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const product = await ProductService.getProduct(
      resolvedParams.id,
      resolvedParams.locale
    );

    // Get image URL - use first image if available
    const imageUrl = product.images && product.images.length > 0
      ? product.images[0]
      : undefined;

    // Generate meta tags using SEO utilities
    const metaTags = generateProductMetaTags({
      name: product.name,
      description: product.description || '',
      slug: resolvedParams.id,
      imageUrl,
      price: product.price,
      currency: 'USD',
    });

    // Convert to Next.js Metadata format
    return generateSeoMetadata(metaTags, {
      siteName: 'Jiffoo Mall',
      locale: resolvedParams.locale,
    });
  } catch (error) {
    // Return default metadata if product not found
    return {
      title: 'Product Not Found',
      description: 'The requested product could not be found.',
    };
  }
}

/**
 * Product Detail Page Component
 * Fetches product data server-side and renders client component
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = await params;

  let product;
  try {
    product = await ProductService.getProduct(
      resolvedParams.id,
      resolvedParams.locale
    );
  } catch (error) {
    // If product not found, show 404
    notFound();
  }

  // Determine product availability status
  const availability = product.stock && product.stock > 0 ? 'InStock' : 'OutOfStock';

  // Get image URL - use first image if available
  const imageUrl = product.images && product.images.length > 0
    ? product.images[0]
    : undefined;

  // Generate structured data for the product
  const structuredData = generateProductStructuredData({
    name: product.name,
    description: product.description || '',
    slug: resolvedParams.id,
    imageUrl,
    price: product.price,
    currency: 'USD',
    availability,
  });

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />

      {/* Render client component for interactivity */}
      <ProductDetailClient product={product} locale={resolvedParams.locale} />
    </>
  );
}

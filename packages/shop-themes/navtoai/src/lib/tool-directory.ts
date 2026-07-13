import type { Product, ProductImage } from 'shared/src/types/product';

export interface ToolDirectoryPreview {
  imageUrl: string;
  categoryLabel: string;
  categoryAccent: string;
  pricingLabel: string;
  trustLabel: string;
  primarySpec: string;
  summary: string;
  tags: string[];
}

function normalizeText(input?: string | null): string {
  return input?.trim() || '';
}

function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getFirstImage(images?: ProductImage[]): string {
  if (!images?.length) return '/placeholder-product.svg';
  return images.find((item) => item.isMain)?.url || images[0]?.url || '/placeholder-product.svg';
}

function inferCategoryAccent(categoryLabel: string): string {
  const value = categoryLabel.toLowerCase();

  if (value.includes('image') || value.includes('design')) return 'Visual';
  if (value.includes('video') || value.includes('audio')) return 'Media';
  if (value.includes('code') || value.includes('agent') || value.includes('developer')) return 'Build';
  if (value.includes('search') || value.includes('research') || value.includes('knowledge')) return 'Research';

  return 'Workflow';
}

function derivePrimarySpec(product: Product): string {
  const rankedSpec = product.specifications.find(
    (spec) =>
      /model|mode|use case|team|delivery|integration|platform|language/i.test(
        `${spec.group || ''} ${spec.name}`
      )
  );

  if (rankedSpec) {
    return `${titleCase(rankedSpec.name)}: ${rankedSpec.value}`;
  }

  if (product.tags.length > 0) {
    return `${titleCase(product.tags[0])} workflow`;
  }

  return 'Curated for applied AI adoption';
}

function derivePricingLabel(product: Product): string {
  if (Number(product.price) <= 0) {
    return 'Free to explore';
  }

  if (product.originalPrice && product.originalPrice > product.price) {
    const percent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    return `Save ${percent}%`;
  }

  return `From $${Number(product.price).toFixed(0)}`;
}

function deriveTrustLabel(product: Product): string {
  if (product.reviewCount > 0 && product.rating > 0) {
    return `${product.rating.toFixed(1)} rating from ${product.reviewCount} reviews`;
  }

  if (product.isFeatured) {
    return 'Featured directory pick';
  }

  if (product.inventory?.isInStock) {
    return 'Available for immediate checkout';
  }

  return 'Operator-ready catalog entry';
}

function deriveSummary(product: Product): string {
  const summary = normalizeText(product.description);
  if (!summary) {
    return 'A curated AI tool listing with a cleaner directory-style presentation for discovery and evaluation.';
  }

  const [firstSentence] = summary.split(/(?<=[.!?])\s+/);
  return firstSentence || summary;
}

export function getToolDirectoryPreview(product: Product): ToolDirectoryPreview {
  const categoryLabel = normalizeText(product.category?.name) || 'AI tooling';
  const dedupedTags = Array.from(
    new Set(product.tags.map((tag) => titleCase(tag)).filter((tag): tag is string => Boolean(tag)))
  ).slice(0, 4);

  return {
    imageUrl: getFirstImage(product.images),
    categoryLabel,
    categoryAccent: inferCategoryAccent(categoryLabel),
    pricingLabel: derivePricingLabel(product),
    trustLabel: deriveTrustLabel(product),
    primarySpec: derivePrimarySpec(product),
    summary: deriveSummary(product),
    tags: dedupedTags.length > 0 ? dedupedTags : ['AI', 'Directory'],
  };
}

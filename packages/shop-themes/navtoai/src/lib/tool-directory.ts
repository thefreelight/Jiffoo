import type { Product, ProductImage } from 'shared/src/types/product';
import { getNavCopy } from '../i18n';
import { getSubmissionPlanMeta } from './submission-plan';

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

function humanizeText(input: string): string {
  if (!input) return input;
  if (/[\u3400-\u9fff]/.test(input)) return input;

  return input
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getProductTags(product: Product): string[] {
  return Array.isArray(product.tags) ? product.tags : [];
}

function getProductSpecifications(product: Product): Product['specifications'] {
  return Array.isArray(product.specifications) ? product.specifications : [];
}

function getProductImages(product: Product): ProductImage[] {
  return Array.isArray(product.images) ? product.images : [];
}

function getFirstImage(images?: ProductImage[]): string {
  if (!images?.length) return '/placeholder-product.svg';
  return images.find((item) => item.isMain)?.url || images[0]?.url || '/placeholder-product.svg';
}

function inferCategoryAccent(categoryLabel: string, locale?: string): string {
  const copy = getNavCopy(locale);
  const value = categoryLabel.toLowerCase();

  if (value.includes('image') || value.includes('design') || value.includes('图')) {
    return copy.locale === 'en' ? 'Visual' : copy.locale === 'zh-Hant' ? '視覺' : '视觉';
  }

  if (value.includes('video') || value.includes('audio') || value.includes('影') || value.includes('音')) {
    return copy.locale === 'en' ? 'Media' : copy.locale === 'zh-Hant' ? '媒體' : '媒体';
  }

  if (
    value.includes('code') ||
    value.includes('agent') ||
    value.includes('developer') ||
    value.includes('程') ||
    value.includes('代')
  ) {
    return copy.locale === 'en' ? 'Build' : copy.locale === 'zh-Hant' ? '開發' : '开发';
  }

  if (
    value.includes('search') ||
    value.includes('research') ||
    value.includes('knowledge') ||
    value.includes('知') ||
    value.includes('搜')
  ) {
    return copy.locale === 'en' ? 'Research' : copy.locale === 'zh-Hant' ? '研究' : '研究';
  }

  return copy.locale === 'en' ? 'Workflow' : copy.locale === 'zh-Hant' ? '工作流' : '工作流';
}

function derivePrimarySpec(product: Product, locale?: string): string {
  const copy = getNavCopy(locale);
  const planMeta = getSubmissionPlanMeta(product, locale);
  const specifications = getProductSpecifications(product);
  const tags = getProductTags(product);

  if (planMeta) {
    return planMeta.audience;
  }

  const rankedSpec = specifications.find((spec) =>
    /model|mode|use case|team|delivery|integration|platform|language|类型|场景|模型|语言/i.test(
      `${spec.group || ''} ${spec.name}`,
    ),
  );

  if (rankedSpec) {
    return `${humanizeText(rankedSpec.name)}: ${rankedSpec.value}`;
  }

  if (tags.length > 0) {
    const tag = humanizeText(tags[0]);
    if (copy.locale === 'en') return `${tag} workflow`;
    if (copy.locale === 'zh-Hant') return `${tag} 工作流`;
    return `${tag} 工作流`;
  }

  if (copy.locale === 'en') return 'Curated for serious AI evaluation';
  if (copy.locale === 'zh-Hant') return '適合嚴肅 AI 評估場景';
  return '适合严肃 AI 评估场景';
}

function formatCurrency(amount: number, locale?: string): string {
  const copy = getNavCopy(locale);
  const intlLocale =
    copy.locale === 'zh-Hant' ? 'zh-Hant-TW' : copy.locale === 'zh-Hans' ? 'zh-Hans-CN' : 'en-US';

  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
}

function derivePricingLabel(product: Product, locale?: string): string {
  const copy = getNavCopy(locale);
  const price = Number(product.price || 0);
  const planMeta = getSubmissionPlanMeta(product, locale);

  if (price <= 0) {
    return copy.common.free;
  }

  if (product.originalPrice && product.originalPrice > product.price) {
    const percent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    if (copy.locale === 'en') return `Save ${percent}%`;
    if (copy.locale === 'zh-Hant') return `現省 ${percent}%`;
    return `立省 ${percent}%`;
  }

  if (copy.locale === 'en') return `From ${formatCurrency(price, locale)}`;
  if (planMeta) {
    if (copy.locale === 'zh-Hant') return `${formatCurrency(price, locale)} / 月`;
    if (copy.locale === 'zh-Hans') return `${formatCurrency(price, locale)} / 月`;
  }
  if (copy.locale === 'zh-Hant') return `${formatCurrency(price, locale)} 起`;
  return `${formatCurrency(price, locale)} 起`;
}

function deriveTrustLabel(product: Product, locale?: string): string {
  const copy = getNavCopy(locale);
  const planMeta = getSubmissionPlanMeta(product, locale);

  if (planMeta) {
    return planMeta.reviewNote;
  }

  if (product.reviewCount > 0 && product.rating > 0) {
    if (copy.locale === 'en') {
      return `${product.rating.toFixed(1)} from ${product.reviewCount} ${copy.common.reviews}`;
    }

    return `${product.rating.toFixed(1)} / ${product.reviewCount}${copy.common.reviews}`;
  }

  if (product.isFeatured) {
    return copy.common.featuredPick;
  }

  if (product.inventory?.isInStock) {
    return copy.common.inStock;
  }

  return copy.common.operatorReady;
}

function deriveSummary(product: Product, locale?: string): string {
  const summary = normalizeText(product.description);
  const planMeta = getSubmissionPlanMeta(product, locale);

  if (planMeta) {
    return planMeta.paymentNote;
  }

  if (!summary) {
    const copy = getNavCopy(locale);
    if (copy.locale === 'en') {
      return 'A curated AI listing with a cleaner directory-style presentation for discovery and comparison.';
    }

    if (copy.locale === 'zh-Hant') {
      return '一個以更清晰目錄方式呈現、方便探索與比較的 AI 項目條目。';
    }

    return '一个以更清晰目录方式呈现、方便探索与比较的 AI 项目条目。';
  }

  const [firstSentence] = summary.split(/(?<=[.!?])\s+/);
  return firstSentence || summary;
}

export function getToolDirectoryPreview(
  product: Product,
  options?: {
    locale?: string;
  },
): ToolDirectoryPreview {
  const locale = options?.locale;
  const copy = getNavCopy(locale);
  const planMeta = getSubmissionPlanMeta(product, locale);
  const categoryLabel =
    planMeta?.kindLabel ||
    normalizeText(product.category?.name) ||
    (copy.locale === 'en' ? 'AI Tooling' : 'AI 工具');
  const tagCandidates = getProductTags(product)
    .map((tag) => humanizeText(tag))
    .filter((tag): tag is string => Boolean(tag));
  const dedupedTags: string[] = Array.from(new Set<string>(tagCandidates)).slice(0, 4);

  return {
    imageUrl: getFirstImage(getProductImages(product)),
    categoryLabel,
    categoryAccent: inferCategoryAccent(categoryLabel, locale),
    pricingLabel: derivePricingLabel(product, locale),
    trustLabel: deriveTrustLabel(product, locale),
    primarySpec: derivePrimarySpec(product, locale),
    summary: deriveSummary(product, locale),
    tags:
      dedupedTags.length > 0
        ? dedupedTags
        : copy.locale === 'en'
          ? ['AI', 'Directory']
          : ['AI', '导航站'],
  };
}

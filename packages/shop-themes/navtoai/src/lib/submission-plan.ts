import type { Product } from 'shared/src/types/product';
import { getNavCopy } from '../i18n';

interface SubmissionPlanMeta {
  kindLabel: string;
  reviewNote: string;
  paymentNote: string;
  audience: string;
  benefits: string[];
}

export type SubmissionPlanId = 'starter' | 'pro' | 'studio';

export interface SubmissionPlanDefinition {
  id: SubmissionPlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  badge?: string;
  href: string;
}

function containsSubmissionSignals(value: string): boolean {
  return /(submit|submission|listing|directory|featured|sponsor|sponsored|plan|subscription|launch|上架|提交|收录|收錄|订阅|訂閱|方案|套餐|曝光|推薦)/i.test(
    value,
  );
}

function tierFallbacks(name: string, locale?: string): string[] {
  const copy = getNavCopy(locale).locale;
  const normalized = name.toLowerCase();
  const tier = normalized.includes('studio')
    ? 'studio'
    : normalized.includes('pro')
      ? 'pro'
      : normalized.includes('starter')
        ? 'starter'
        : 'generic';

  const map = {
    en: {
      starter: ['Directory listing', 'Standard editorial review', 'Monthly listing refresh'],
      pro: ['Homepage candidate pool', 'Priority editorial review', 'Expanded brand profile'],
      studio: ['Editorial feature opportunities', 'Multilingual listing profile', 'Highest priority support'],
      generic: ['Editorial review included', 'Category positioning', 'Ongoing listing coverage'],
    },
    zhHans: {
      starter: ['目录收录', '标准人工审核', '每月信息更新'],
      pro: ['首页推荐候选池', '优先人工审核', '更完整品牌资料'],
      studio: ['专题曝光机会', '多语言展示资料', '最高优先支持'],
      generic: ['包含人工审核', '分类定位优化', '持续收录维护'],
    },
    zhHant: {
      starter: ['目錄收錄', '標準人工審核', '每月資訊更新'],
      pro: ['首頁推薦候選池', '優先人工審核', '更完整品牌資料'],
      studio: ['專題曝光機會', '多語言展示資料', '最高優先支援'],
      generic: ['包含人工審核', '分類定位優化', '持續收錄維護'],
    },
  } as const;

  if (copy === 'zh-Hans') return [...map.zhHans[tier]];
  if (copy === 'zh-Hant') return [...map.zhHant[tier]];
  return [...map.en[tier]];
}

function extractBenefits(product: Product, locale?: string): string[] {
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const benefits = specifications
    .filter((spec) =>
      /(benefit|feature|review|listing|homepage|support|language|曝光|审核|審核|推荐|推薦|支持|支援|語言|语言)/i.test(
        `${spec.group || ''} ${spec.name} ${spec.value}`,
      ),
    )
    .map((spec) => `${spec.name}: ${spec.value}`);

  if (benefits.length > 0) {
    return benefits.slice(0, 4);
  }

  return tierFallbacks(product.name, locale);
}

export function isSubmissionPlanProduct(
  product?: Pick<Product, 'name' | 'category' | 'tags' | 'specifications'> | null,
): boolean {
  if (!product) return false;

  const tags = Array.isArray(product.tags) ? product.tags : [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const haystacks = [
    product.name || '',
    product.category?.name || '',
    ...tags,
    ...specifications.flatMap((spec) => [spec.group || '', spec.name || '', spec.value || '']),
  ];

  return haystacks.some(containsSubmissionSignals);
}

export function getSubmissionPlanMeta(product: Product, locale?: string): SubmissionPlanMeta | null {
  if (!isSubmissionPlanProduct(product)) return null;

  const resolved = getNavCopy(locale).locale;

  if (resolved === 'zh-Hant') {
    return {
      kindLabel: '提交方案',
      reviewNote: '所有方案都包含人工審核與分類定位，不保證付款後一定上架。',
      paymentNote: '付款由站點既有支付插件處理，例如 Stripe，主題本身不直接收款。',
      audience: '適合想在 NavtoAI 內獲得穩定曝光與高品質收錄的 AI 項目。',
      benefits: extractBenefits(product, locale),
    };
  }

  if (resolved === 'zh-Hans') {
    return {
      kindLabel: '提交方案',
      reviewNote: '所有方案都包含人工审核和分类定位，付款后也仍需通过审核才能上架。',
      paymentNote: '付款由站点现有支付插件处理，例如 Stripe，主题本身不直接收款。',
      audience: '适合想在 NavtoAI 内获得稳定曝光和高质量收录的 AI 项目。',
      benefits: extractBenefits(product, locale),
    };
  }

  return {
    kindLabel: 'Submission plan',
    reviewNote: 'Every plan includes editorial review and category positioning. Payment does not guarantee publication.',
    paymentNote: 'Payments are handled by installed payment plugins, such as Stripe. The theme does not charge directly.',
    audience: 'Designed for AI products that want stronger placement and cleaner positioning inside NavtoAI.',
    benefits: extractBenefits(product, locale),
  };
}

export function getSubmissionPlanMetaByName(name: string, locale?: string): SubmissionPlanMeta | null {
  if (!containsSubmissionSignals(name)) return null;

  const resolved = getNavCopy(locale).locale;
  const benefits = tierFallbacks(name, locale);

  if (resolved === 'zh-Hant') {
    return {
      kindLabel: '提交方案',
      reviewNote: '這是一個提交訂閱方案，仍需人工審核後才會正式上架。',
      paymentNote: '付款由站點既有支付插件處理，例如 Stripe。',
      audience: '適合希望在 NavtoAI 內獲得穩定曝光的 AI 項目。',
      benefits,
    };
  }

  if (resolved === 'zh-Hans') {
    return {
      kindLabel: '提交方案',
      reviewNote: '这是一个提交订阅方案，仍需人工审核后才会正式上架。',
      paymentNote: '付款由站点现有支付插件处理，例如 Stripe。',
      audience: '适合希望在 NavtoAI 内获得稳定曝光的 AI 项目。',
      benefits,
    };
  }

  return {
    kindLabel: 'Submission plan',
    reviewNote: 'This is a paid submission plan and still requires editorial approval before publication.',
    paymentNote: 'Payments are handled by installed payment plugins, such as Stripe.',
    audience: 'Designed for AI products that want stronger placement inside NavtoAI.',
    benefits,
  };
}

function getPlanSearchHref(id: SubmissionPlanId): string {
  const queryMap: Record<SubmissionPlanId, string> = {
    starter: 'Starter submission plan',
    pro: 'Pro submission plan',
    studio: 'Studio submission plan',
  };

  return `/search?q=${encodeURIComponent(queryMap[id])}`;
}

export function getFallbackSubmissionPlans(locale?: string): SubmissionPlanDefinition[] {
  const resolved = getNavCopy(locale).locale;

  if (resolved === 'zh-Hant') {
    return [
      {
        id: 'starter',
        name: 'Starter',
        price: '$29',
        period: '/月',
        description: '適合剛起步產品，收錄進搜尋結果與分類頁。',
        features: ['基礎收錄', '標準審核', '每月可更新一次'],
        href: getPlanSearchHref('starter'),
      },
      {
        id: 'pro',
        name: 'Pro',
        price: '$79',
        period: '/月',
        description: '加入首頁推薦池與更完整的品牌展示。',
        features: ['首頁候選曝光', '更完整簡介', '優先審核'],
        badge: '推薦方案',
        href: getPlanSearchHref('pro'),
      },
      {
        id: 'studio',
        name: 'Studio',
        price: '$199',
        period: '/月',
        description: '給需要專題曝光、編輯推薦與多語系展示的大型項目。',
        features: ['專題展示機會', '多語系資訊', '高優先支持'],
        href: getPlanSearchHref('studio'),
      },
    ];
  }

  if (resolved === 'zh-Hans') {
    return [
      {
        id: 'starter',
        name: 'Starter',
        price: '$29',
        period: '/月',
        description: '适合刚起步产品，收录进搜索结果和分类页。',
        features: ['基础收录', '标准审核', '每月可更新一次'],
        href: getPlanSearchHref('starter'),
      },
      {
        id: 'pro',
        name: 'Pro',
        price: '$79',
        period: '/月',
        description: '加入首页推荐池与更完整的品牌展示。',
        features: ['首页候选曝光', '更完整简介', '优先审核'],
        badge: '推荐方案',
        href: getPlanSearchHref('pro'),
      },
      {
        id: 'studio',
        name: 'Studio',
        price: '$199',
        period: '/月',
        description: '给需要专题曝光、编辑推荐和多语言展示的大型项目。',
        features: ['专题展示机会', '多语言信息', '高优先支持'],
        href: getPlanSearchHref('studio'),
      },
    ];
  }

  return [
    {
      id: 'starter',
      name: 'Starter',
      price: '$29',
      period: '/mo',
      description: 'For early products that need category placement and search visibility.',
      features: ['Base listing', 'Standard review', 'One update per month'],
      href: getPlanSearchHref('starter'),
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$79',
      period: '/mo',
      description: 'Adds homepage recommendation eligibility and richer brand presentation.',
      features: ['Homepage candidate pool', 'Expanded profile', 'Priority review'],
      badge: 'Best value',
      href: getPlanSearchHref('pro'),
    },
    {
      id: 'studio',
      name: 'Studio',
      price: '$199',
      period: '/mo',
      description: 'For bigger launches that need editorial features and multilingual presentation.',
      features: ['Editorial features', 'Multilingual profile', 'Highest priority support'],
      href: getPlanSearchHref('studio'),
    },
  ];
}

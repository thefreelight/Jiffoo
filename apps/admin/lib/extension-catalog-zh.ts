/**
 * Simplified/Traditional Chinese overlays for official-extension catalog
 * entries. The marketplace catalog carries English-only name/description
 * fields (the platform catalog API has no localized fields), so the admin
 * renders these overlays when the session locale is Chinese. Slugs without
 * an entry fall back to the catalog text.
 */

export interface ExtensionCatalogLocalization {
  name: string;
  description: string;
}

const ZH_HANS: Record<string, ExtensionCatalogLocalization> = {
  seo: {
    name: 'SEO 管理器',
    description: '重定向管理：命中统计、404 监控与一键转换。robots.txt、sitemap.xml、canonical/hreflang 与产品结构化数据已内置于框架，随店面自动生效。',
  },
  'programmatic-seo': {
    name: '程序化 SEO',
    description: '按模板批量生成 SEO 落地页，通过店面路由渲染，放大长尾关键词覆盖。',
  },
  'aeo-booster': {
    name: 'AEO 加速器',
    description: '面向 AI 搜索的答案引擎优化：AI 爬虫访问策略、llms.txt 与 FAQ 结构化数据。',
  },
  cms: { name: '内容管理', description: '站点内容与 CMS 能力。' },
  i18n: { name: '多语言', description: '店面多语言与区域设置管理。' },
  coupon: { name: '优惠券', description: '优惠券与促销规则管理。' },
  reviews: { name: '商品评价', description: '商品评价收集与展示。' },
  'media-storage': { name: '媒体存储', description: '图片与媒体资源的存储管理。' },
};

const ZH_HANT: Record<string, ExtensionCatalogLocalization> = {
  seo: {
    name: 'SEO 管理器',
    description: '重定向管理：命中統計、404 監控與一鍵轉換。robots.txt、sitemap.xml、canonical/hreflang 與商品結構化資料已內建於框架，隨店面自動生效。',
  },
  'programmatic-seo': {
    name: '程式化 SEO',
    description: '按模板批次生成 SEO 落地頁，透過店面路由渲染，放大長尾關鍵字覆蓋。',
  },
  'aeo-booster': {
    name: 'AEO 加速器',
    description: '面向 AI 搜尋的答案引擎最佳化：AI 爬蟲存取策略、llms.txt 與 FAQ 結構化資料。',
  },
  cms: { name: '內容管理', description: '站點內容與 CMS 能力。' },
  i18n: { name: '多語言', description: '店面多語言與區域設定管理。' },
  coupon: { name: '優惠券', description: '優惠券與促銷規則管理。' },
  reviews: { name: '商品評價', description: '商品評價收集與展示。' },
  'media-storage': { name: '媒體儲存', description: '圖片與媒體資源的儲存管理。' },
};

export function localizeExtensionName(slug: string, fallback: string, locale?: string): string {
  if (!locale || !locale.startsWith('zh')) return fallback;
  const table = locale === 'zh-Hant' ? ZH_HANT : ZH_HANS;
  return table[slug]?.name ?? fallback;
}

export function localizeExtensionDescription(slug: string, fallback: string, locale?: string): string {
  if (!locale || !locale.startsWith('zh')) return fallback;
  const table = locale === 'zh-Hant' ? ZH_HANT : ZH_HANS;
  return table[slug]?.description ?? fallback;
}

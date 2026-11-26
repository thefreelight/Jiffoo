import React from 'react';
import { ChevronLeft, ChevronRight, Grid3X3, List, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { Product } from 'shared/src/types/product';
import type { ProductsPageProps } from 'shared/src/types/theme';
import {
  displayProductTitle,
  getBokmooCatalog,
  getBokmooProducts,
  mapBokmooApiProductToThemeProduct,
  normalizeProductForTheme,
  resolveBokmooMediaUrl,
  type BokmooApiProduct,
} from '../lib/api';
import { getBokmooTravelProfile } from '../lib/digital-fulfillment';
import { pickCopy, resolveBokmooSiteConfig, type BokmooCatalogProducts } from '../site';
import { saleFor, useActiveSales } from '../lib/sale';
import { SalePrice } from './SalePrice';

type Copy = { en: string; hans?: string; hant?: string; ja?: string; ko?: string; fr?: string; de?: string };

const PAGE_SIZE = 12;

const CATALOG_FILTERS = ['All', 'Popular', 'Local', 'Regional', 'Global'] as const;
type CatalogFilter = (typeof CATALOG_FILTERS)[number];

const FILTER_LABELS: Record<CatalogFilter, Copy> = {
  All: { en: 'All', hans: '全部', hant: '全部' },
  Popular: { en: 'Popular', hans: '热门', hant: '熱門' },
  Local: { en: 'Local', hans: '本地', hant: '本地' },
  Regional: { en: 'Regional', hans: '区域', hant: '區域' },
  Global: { en: 'Global', hans: '全球', hant: '全球' },
};

const SORT_LABELS: Record<string, Copy> = {
  createdAt: { en: 'Newest', hans: '最新', hant: '最新', ja: '新着', ko: '최신순', fr: 'Récents', de: 'Neueste' },
  price: { en: 'Price', hans: '价格', hant: '價格', ja: '価格', ko: '가격', fr: 'Prix', de: 'Preis' },
  name: { en: 'Name', hans: '名称', hant: '名稱', ja: '名前', ko: '이름', fr: 'Nom', de: 'Name' },
};

/**
 * What the page says, by what it lists. The official store carries cards only; plans live on the
 * eSIM mall, which uses its own theme.
 */
const ASSORTMENT_COPY: Record<BokmooCatalogProducts, { eyebrow: Copy; heading: Copy; lead: Copy; search: Copy; unit: Copy; empty: Copy; error: Copy }> = {
  cards: {
    eyebrow: { en: 'Card collection', hans: '卡片系列', hant: '卡片系列', ja: 'カードラインナップ', ko: '카드 라인업', fr: 'Collection de cartes', de: 'Kartenkollektion' },
    heading: { en: 'BOKMOO cards.', hans: 'BOKMOO 实体卡。', hant: 'BOKMOO 實體卡。', ja: 'BOKMOO カード。', ko: 'BOKMOO 카드.', fr: 'Les cartes BOKMOO.', de: 'BOKMOO-Karten.' },
    lead: {
      en: 'Physical eSIM cards that work with the BOKMOO app: load your eSIM profiles on the card and carry them with you.',
      hans: '与 BOKMOO App 配合使用的实体 eSIM 卡：把 eSIM 配置下载到卡上，随身携带。',
      hant: '與 BOKMOO App 配合使用的實體 eSIM 卡：把 eSIM 設定檔下載到卡上，隨身攜帶。',
      ja: 'BOKMOO アプリと連携する物理 eSIM カード。eSIM プロファイルをカードに書き込んで持ち歩けます。',
      ko: 'BOKMOO 앱과 함께 쓰는 물리 eSIM 카드. eSIM 프로필을 카드에 내려받아 휴대하세요.',
      fr: 'Des cartes eSIM physiques qui fonctionnent avec l’app BOKMOO : chargez vos profils eSIM sur la carte et emportez-les.',
      de: 'Physische eSIM-Karten für die BOKMOO-App: eSIM-Profile auf die Karte laden und mitnehmen.',
    },
    search: { en: 'Search cards…', hans: '搜索卡片…', hant: '搜尋卡片…', ja: 'カードを検索…', ko: '카드 검색…', fr: 'Rechercher une carte…', de: 'Karte suchen…' },
    unit: { en: 'cards', hans: '款卡片', hant: '款卡片', ja: '枚のカード', ko: '개의 카드', fr: 'cartes', de: 'Karten' },
    empty: { en: 'No cards matched the current search.', hans: '没有符合当前搜索的卡片。', hant: '沒有符合當前搜尋的卡片。', ja: '検索に一致するカードはありません。', ko: '검색어에 맞는 카드가 없습니다.', fr: 'Aucune carte ne correspond à la recherche.', de: 'Keine Karte entspricht der Suche.' },
    error: { en: 'Cards are unavailable right now.', hans: '卡片暂时无法获取。', hant: '卡片暫時無法取得。', ja: 'カードを現在読み込めません。', ko: '지금은 카드를 불러올 수 없습니다.', fr: 'Les cartes sont indisponibles pour le moment.', de: 'Karten sind derzeit nicht verfügbar.' },
  },
  plans: {
    eyebrow: { en: 'Plan collection', hans: '套餐集合', hant: '套餐集合' },
    heading: { en: 'eSIM plans built for every journey.', hans: '为每一段旅程而生的 eSIM 套餐。', hant: '為每一段旅程而生的 eSIM 套餐。' },
    lead: {
      en: 'Explore destination-ready profiles, regional bundles, and premium data options with the clarity of a product catalog.',
      hans: '探索目的地套餐、区域组合与高级流量选项，像商品目录一样一目了然。',
      hant: '探索目的地套餐、區域組合與高級流量選項，像商品目錄一樣一目了然。',
    },
    search: { en: 'Search destinations or bundles...', hans: '搜索目的地或套餐…', hant: '搜尋目的地或套餐…' },
    unit: { en: 'plans', hans: '个套餐', hant: '個套餐' },
    empty: { en: 'No plans matched the current search.', hans: '没有符合当前搜索的套餐。', hant: '沒有符合當前搜尋的套餐。' },
    error: { en: 'Plans are unavailable right now.', hans: '套餐暂时无法获取。', hant: '套餐暫時無法取得。' },
  },
  all: {
    eyebrow: { en: 'Collection', hans: '全部商品', hant: '全部商品', ja: 'ラインナップ', ko: '컬렉션', fr: 'Collection', de: 'Kollektion' },
    heading: { en: 'The BOKMOO collection.', hans: 'BOKMOO 全部商品。', hant: 'BOKMOO 全部商品。', ja: 'BOKMOO の全商品。', ko: 'BOKMOO 전체 상품.', fr: 'La collection BOKMOO.', de: 'Die BOKMOO-Kollektion.' },
    lead: {
      en: 'BOKMOO cards and the eSIM plans that run on them.',
      hans: 'BOKMOO 实体卡，以及可以在卡上使用的 eSIM 套餐。',
      hant: 'BOKMOO 實體卡，以及可以在卡上使用的 eSIM 套餐。',
      ja: 'BOKMOO カードと、カードで使える eSIM プラン。',
      ko: 'BOKMOO 카드와 카드에서 쓸 수 있는 eSIM 요금제.',
      fr: 'Les cartes BOKMOO et les forfaits eSIM qui fonctionnent avec.',
      de: 'BOKMOO-Karten und die eSIM-Tarife, die darauf laufen.',
    },
    search: { en: 'Search cards or plans…', hans: '搜索卡片或套餐…', hant: '搜尋卡片或套餐…', ja: 'カードまたはプランを検索…', ko: '카드 또는 요금제 검색…', fr: 'Rechercher une carte ou un forfait…', de: 'Karte oder Tarif suchen…' },
    unit: { en: 'products', hans: '件商品', hant: '件商品', ja: '点の商品', ko: '개의 상품', fr: 'produits', de: 'Produkte' },
    empty: { en: 'No products matched the current search.', hans: '没有符合当前搜索的商品。', hant: '沒有符合當前搜尋的商品。', ja: '検索に一致する商品はありません。', ko: '검색어에 맞는 상품이 없습니다.', fr: 'Aucun produit ne correspond à la recherche.', de: 'Kein Produkt entspricht der Suche.' },
    error: { en: 'Products are unavailable right now.', hans: '商品暂时无法获取。', hant: '商品暫時無法取得。', ja: '商品を現在読み込めません。', ko: '지금은 상품을 불러올 수 없습니다.', fr: 'Les produits sont indisponibles pour le moment.', de: 'Produkte sind derzeit nicht verfügbar.' },
  },
};

const PREVIOUS_PAGE: Copy = { en: 'Previous page', hans: '上一页', hant: '上一頁', ja: '前のページ', ko: '이전 페이지', fr: 'Page précédente', de: 'Vorherige Seite' };
const NEXT_PAGE: Copy = { en: 'Next page', hans: '下一页', hant: '下一頁', ja: '次のページ', ko: '다음 페이지', fr: 'Page suivante', de: 'Nächste Seite' };

const CARD_EYEBROW: Copy = { en: 'Physical eSIM card', hans: '实体 eSIM 卡', hant: '實體 eSIM 卡', ja: '物理 eSIM カード', ko: '물리 eSIM 카드', fr: 'Carte eSIM physique', de: 'Physische eSIM-Karte' };
const VIEW_CARD: Copy = { en: 'View card', hans: '查看卡片', hant: '查看卡片', ja: 'カードを見る', ko: '카드 보기', fr: 'Voir la carte', de: 'Karte ansehen' };

type Language = 'en' | 'hans' | 'hant' | 'ja' | 'ko' | 'fr' | 'de';

function languageOf(locale: string | undefined): Language {
  if (locale === 'zh-Hans') return 'hans';
  if (locale === 'zh-Hant') return 'hant';
  if (locale === 'ja' || locale === 'ko' || locale === 'fr' || locale === 'de') return locale;
  return 'en';
}

const PAGE_LABEL: Record<Language, (page: number, total: number) => string> = {
  en: (page, total) => `Page ${page} of ${total}`,
  hans: (page, total) => `第 ${page} / ${total} 页`,
  hant: (page, total) => `第 ${page} / ${total} 頁`,
  ja: (page, total) => `${page} / ${total} ページ`,
  ko: (page, total) => `${page} / ${total} 페이지`,
  fr: (page, total) => `Page ${page} sur ${total}`,
  de: (page, total) => `Seite ${page} von ${total}`,
};

/** A physical card; everything else in the catalog is a plan. */
function isCard(item: { productKind?: string }): boolean {
  return item.productKind === 'goods';
}

function inAssortment(item: { productKind?: string }, assortment: BokmooCatalogProducts): boolean {
  if (assortment === 'cards') return isCard(item);
  if (assortment === 'plans') return !isCard(item);
  return true;
}

function getProductImage(product: Product): string | null {
  if (!product?.images?.length) return null;
  const primary = product.images.find((image) => image.isMain) || product.images[0];
  return primary?.url || null;
}

function productText(product: { name?: string; description?: string; typeData?: { esim?: { country?: string; region?: string; carrier?: string } } }): string {
  const esim = product.typeData?.esim;
  return [product.name, product.description, esim?.country, esim?.region, esim?.carrier].filter(Boolean).join(' ').toLowerCase();
}

function matchesCatalogFilter(product: { typeData?: { esim?: { country?: string; region?: string } } }, filter: CatalogFilter): boolean {
  const esim = product.typeData?.esim;
  const region = (esim?.region || '').toLowerCase();
  const country = (esim?.country || '').toLowerCase();

  if (filter === 'All' || filter === 'Popular') return true;
  if (filter === 'Global') return region.includes('global') || country.includes('global');
  if (filter === 'Regional') return Boolean(region && !region.includes('global') && region !== country);
  if (filter === 'Local') return Boolean(country && (!region || region === country || !region.includes('global')));
  return true;
}

/** The price checkout bills: the cheapest sellable variant, else the list price. */
function sellablePrice(product: { price?: number; variants?: Array<{ price?: number; salePrice?: number }> }): number {
  const prices = (product.variants || [])
    .map((variant) => Number(variant.salePrice || variant.price || 0))
    .filter((price) => price > 0);
  const listPrice = Number(product.price || 0);
  return prices.length > 0 ? Math.min(listPrice > 0 ? listPrice : Number.POSITIVE_INFINITY, ...prices) : listPrice;
}

/** "Newest" follows the catalog's own order (the newest change first); price and name sort here. */
function sortProducts<T extends { name: string }>(products: T[], sortBy: string, priceOf: (product: T) => number, changedAt: (product: T) => string): T[] {
  const sorted = [...products];
  if (sortBy === 'price') {
    sorted.sort((a, b) => priceOf(a) - priceOf(b));
  } else if (sortBy === 'name') {
    sorted.sort((a, b) => displayProductTitle(a.name).localeCompare(displayProductTitle(b.name)));
  } else if (sortBy === 'createdAt') {
    sorted.sort((a, b) => changedAt(b).localeCompare(changedAt(a)));
  }
  return sorted;
}

/** The first paragraph of a card's description, kept short enough for a tile. */
function cardSummary(description: string | undefined): string {
  const paragraph = String(description || '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (paragraph.length <= 150) return paragraph;
  return `${paragraph.slice(0, 149).replace(/\s+\S*$/, '')}…`;
}

function ProductMedia({ product, apiBaseUrl }: { product: Product; apiBaseUrl?: string }) {
  const image = resolveBokmooMediaUrl(getProductImage(product), apiBaseUrl);
  const profile = getBokmooTravelProfile(product);
  const card = isCard(product);

  if (image) {
    return (
      <img
        src={image}
        alt={displayProductTitle(product.name)}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent),transparent_55%),linear-gradient(180deg,var(--bokmoo-bg-elevated),var(--bokmoo-bg))] p-5">
      {card ? null : (
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.2em] text-[var(--bokmoo-gold)]">
            {profile.cardEyebrow}
          </span>
          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy)]">
            {profile.planBadge}
          </span>
        </div>
      )}
      <div>
        <p className="text-sm tracking-[0.22em] text-[var(--bokmoo-copy-soft)]">BOKMOO</p>
        <p className="mt-3 text-2xl leading-[0.98] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
          {card ? displayProductTitle(product.name) : profile.coverageLabel}
        </p>
      </div>
    </div>
  );
}

const ARTICLE_CLASS =
  'overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-elevated)_82%,black)] shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1 sm:rounded-[var(--bokmoo-radius-xl)]';
const GOLD_BUTTON_CLASS =
  'mt-4 w-full rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]';

/**
 * The catalog page. The theme reads the catalog itself and pages through it: the theme's read is the one
 * that carries the BOKMOO facts the tiles show. Which page is on show is kept here — the page shown
 * earlier never changed because the read ran once, on the first render, and never again.
 */
export const ProductsPage = React.memo(function ProductsPage({
  products,
  isLoading,
  totalProducts,
  currentPage,
  totalPages,
  sortBy,
  viewMode,
  onSortChange,
  onViewModeChange,
  onAddToCart,
  onProductClick,
  config,
  locale,
}: ProductsPageProps) {
  const sales = useActiveSales(locale);
  const assortment = resolveBokmooSiteConfig(config, locale).catalogProducts;
  // Cards, or cards and plans, are picked out of one read of the whole catalog; plans come page by page
  const wholeCatalog = assortment !== 'plans';
  const t = (copy: Copy) => pickCopy(locale, copy);
  const copy = ASSORTMENT_COPY[assortment];
  const apiBaseUrl = resolveBokmooSiteConfig(config, locale).apiBaseUrl;

  const listRef = React.useRef<HTMLElement | null>(null);
  const readId = React.useRef(0);
  // A search page arrives as /search?q=…: start from what was asked for
  const [activeSearch, setActiveSearch] = React.useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('q')?.trim() ?? ''));
  const [searchQuery, setSearchQuery] = React.useState(activeSearch);
  const [remoteItems, setRemoteItems] = React.useState<BokmooApiProduct[]>([]);
  const [remoteTotal, setRemoteTotal] = React.useState(0);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState<CatalogFilter>('All');
  const [page, setPage] = React.useState(currentPage || 1);

  // Depends on plain values only: the store hands down a new config object on every render. The whole
  // catalog is read once whatever page is on show; only page-by-page reads follow the page.
  const pageToRead = wholeCatalog ? 1 : page;
  const load = React.useCallback(async () => {
    const id = ++readId.current;
    setRemoteLoading(true);
    setRemoteError('');
    try {
      const response = wholeCatalog
        ? await getBokmooCatalog({ baseUrl: apiBaseUrl }, { locale: locale || 'en' })
        : await getBokmooProducts({ baseUrl: apiBaseUrl }, { page: pageToRead, limit: PAGE_SIZE, locale: locale || 'en', type: 'esim' });
      if (id !== readId.current) return;
      setRemoteItems(response.items.filter((item) => inAssortment(item, assortment)));
      setRemoteTotal(Number(response.total || 0));
    } catch (error) {
      if (id !== readId.current) return;
      setRemoteError(error instanceof Error ? error.message : t(copy.error));
      setRemoteItems([]);
      setRemoteTotal(0);
    } finally {
      if (id === readId.current) setRemoteLoading(false);
    }
  }, [apiBaseUrl, locale, wholeCatalog, assortment, pageToRead]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const usingRemote = remoteItems.length > 0;
  const need = activeSearch.trim().toLowerCase();

  // What is on show: the assortment, narrowed by the search box and the plan filters, in the chosen order
  const scoped = React.useMemo(() => {
    if (!usingRemote) {
      return products.filter(
        (product) =>
          inAssortment(product, assortment) &&
          (!need || productText(product).includes(need)) &&
          (assortment === 'cards' || matchesCatalogFilter(product, selectedFilter))
      );
    }
    const items = remoteItems.filter(
      (item) => (!need || productText(item).includes(need)) && (assortment === 'cards' || matchesCatalogFilter(item, selectedFilter))
    );
    return sortProducts(items, sortBy, sellablePrice, (item) => String(item.sourceUpdatedAt || ''));
  }, [usingRemote, products, remoteItems, need, selectedFilter, assortment, sortBy]);

  const source = usingRemote ? 'remote' : 'host';
  // The whole catalog is paged here; page-by-page reads carry their own total
  const displayTotal = source === 'remote' ? (wholeCatalog ? scoped.length : remoteTotal) : totalProducts;
  const displayTotalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE), source === 'host' ? totalPages : 1);
  const pageShown = Math.min(page, displayTotalPages);
  const pageItems = wholeCatalog ? scoped.slice((pageShown - 1) * PAGE_SIZE, pageShown * PAGE_SIZE) : scoped;
  const normalizedProducts = React.useMemo(
    () => pageItems.map((item) => normalizeProductForTheme(usingRemote ? mapBokmooApiProductToThemeProduct(item as BokmooApiProduct) : (item as Product))),
    [pageItems, usingRemote]
  );

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setActiveSearch(searchQuery.trim());
    setPage(1);
  };

  const goToPage = (next: number) => {
    const target = Math.max(1, Math.min(displayTotalPages, next));
    if (target === pageShown) return;
    setPage(target);
    const list = listRef.current;
    if (list) window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
  };

  if (isLoading || (remoteLoading && normalizedProducts.length === 0)) {
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),color-mix(in_oklab,var(--bokmoo-bg-elevated)_76%,black)] p-5 shadow-[var(--bokmoo-shadow)] sm:rounded-[var(--bokmoo-radius-xl)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                {t(copy.eyebrow)}
              </div>
              <h1 className="mt-5 text-[clamp(2.3rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                {t(copy.heading)}
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--bokmoo-copy)]">{t(copy.lead)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:min-w-[34rem]">
              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t(copy.search)}
                  aria-label={t(copy.search)}
                  className="h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] pl-11 pr-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] sm:rounded-full"
                />
              </form>

              <select
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value)}
                aria-label={SORT_LABELS[sortBy] ? t(SORT_LABELS[sortBy]) : t(SORT_LABELS.createdAt)}
                className="h-12 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none sm:rounded-full"
              >
                <option value="createdAt">{t(SORT_LABELS.createdAt)}</option>
                <option value="price">{t(SORT_LABELS.price)}</option>
                <option value="name">{t(SORT_LABELS.name)}</option>
              </select>

              <div className="flex items-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-1 sm:rounded-full">
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'grid'
                      ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]'
                      : 'text-[var(--bokmoo-copy)]'
                  )}
                  type="button"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onViewModeChange('list')}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    viewMode === 'list'
                      ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]'
                      : 'text-[var(--bokmoo-copy)]'
                  )}
                  type="button"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {assortment === 'cards' ? <div /> : (
              <div className="flex flex-wrap gap-2">
                {CATALOG_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setSelectedFilter(filter);
                      setPage(1);
                    }}
                    className={cn(
                      'rounded-[0.8rem] border px-4 py-2 text-[11px] font-semibold transition-colors',
                      selectedFilter === filter
                        ? 'border-[var(--bokmoo-line-strong)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-[var(--bokmoo-bg)]'
                        : 'border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-copy)]'
                    )}
                    type="button"
                  >
                    {t(FILTER_LABELS[filter])}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <span
                className="rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]"
                data-purpose="catalog-count"
              >
                {displayTotal} {t(copy.unit)}
              </span>
              {assortment === 'plans' || assortment === 'all' ? (
                <span className="rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]">
                  {t({ en: 'Instant eSIM delivery', hans: 'eSIM 即时送达', hant: 'eSIM 即時送達' })}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8" ref={listRef}>
          {remoteError && normalizedProducts.length === 0 ? (
            <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
              <p className="text-xl font-semibold text-[var(--bokmoo-ink)]">{t(copy.error)}</p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--bokmoo-copy)]">{remoteError}</p>
              <button
                onClick={() => void load()}
                className="mt-6 min-h-11 rounded-[0.9rem] bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]"
                type="button"
              >
                {t({ en: 'Try Again', hans: '重试', hant: '重試', ja: 'もう一度試す', ko: '다시 시도', fr: 'Réessayer', de: 'Erneut versuchen' })}
              </button>
            </div>
          ) : normalizedProducts.length === 0 ? (
            <div className="rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]">
              {t(copy.empty)}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3 sm:gap-4',
                viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
              )}
              data-purpose="catalog-grid"
            >
              {normalizedProducts.map((product) => {
                const card = isCard(product);
                const media = (
                  <div
                    className={cn(
                      'overflow-hidden border-[var(--bokmoo-line)]',
                      viewMode === 'grid'
                        ? 'aspect-[1.28/1] border-b sm:aspect-[1.18/1]'
                        : 'aspect-[1.45/1] rounded-[1rem] border md:aspect-auto md:h-full md:rounded-[var(--bokmoo-radius-lg)]'
                    )}
                  >
                    <ProductMedia product={product} apiBaseUrl={apiBaseUrl} />
                  </div>
                );
                const sale = saleFor(sales, product.id);

                if (card) {
                  return (
                    <article
                      key={product.id}
                      className={cn(
                        ARTICLE_CLASS,
                        viewMode === 'list' && 'grid gap-4 p-4 md:grid-cols-[14rem_minmax(0,1fr)_12rem] md:items-center md:gap-5 md:p-5'
                      )}
                      data-purpose="catalog-card"
                    >
                      <button
                        onClick={() => onProductClick(product.id)}
                        className={cn(viewMode === 'grid' ? 'block text-left' : 'contents')}
                        type="button"
                      >
                        {media}
                        <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-gold)]">
                            {t(CARD_EYEBROW)}
                          </span>
                          <h2 className="mt-4 text-[clamp(1.7rem,2vw,2.4rem)] leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                            {displayProductTitle(product.name)}
                          </h2>
                          <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">{cardSummary(product.description)}</p>
                        </div>
                      </button>

                      <div className={cn(viewMode === 'grid' ? 'px-5 pb-5' : 'md:w-[12rem]')}>
                        <div className="rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_90%,black)] p-4">
                          <p className="text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                            <SalePrice unitPrice={Number(Number.isFinite(Number(product.price)) ? Number(product.price) : 0)} sale={sale} />
                          </p>
                          <button onClick={() => onProductClick(product.id)} className={GOLD_BUTTON_CLASS} type="button">
                            {t(VIEW_CARD)}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }

                const profile = getBokmooTravelProfile(product);
                const displayPrice = sellablePrice(product);

                return (
                  <article
                    key={product.id}
                    className={cn(
                      ARTICLE_CLASS,
                      viewMode === 'list' && 'grid gap-4 p-4 md:grid-cols-[14rem_minmax(0,1fr)_12rem] md:items-center md:gap-5 md:p-5'
                    )}
                    data-purpose="catalog-plan"
                  >
                    <button
                      onClick={() => onProductClick(product.id)}
                      className={cn(viewMode === 'grid' ? 'block text-left' : 'contents')}
                      type="button"
                    >
                      {media}
                      <div className={cn(viewMode === 'grid' ? 'p-5' : 'min-w-0')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-gold)]">
                            {profile.cardEyebrow}
                          </span>
                          <span className="rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy)]">
                            {profile.deliveryLabel}
                          </span>
                        </div>

                        <h2 className="mt-4 text-[clamp(1.7rem,2vw,2.4rem)] leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                          {displayProductTitle(product.name)}
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]">
                          {product.description || profile.summary}
                        </p>

                        <div className="mt-5 grid gap-2 sm:grid-cols-3">
                          {([
                            [t({ en: 'Coverage', hans: '覆盖范围', hant: '覆蓋範圍' }), profile.coverageLabel],
                            [t({ en: 'Plan', hans: '套餐', hant: '套餐' }), profile.planLabel],
                            [t({ en: 'Validity', hans: '有效期', hant: '有效期' }), profile.durationLabel],
                          ] as [string, string][]).map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-3 py-3"
                            >
                              <p className="text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy-soft)]">{label}</p>
                              <p className="mt-2 text-sm font-medium text-[var(--bokmoo-ink)]">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </button>

                    <div className={cn(viewMode === 'grid' ? 'px-5 pb-5' : 'md:w-[12rem]')}>
                      <div className="rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_90%,black)] p-4">
                        <p className="text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                          {t({ en: 'Starting at', hans: '起价', hant: '起價' })}
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                          <SalePrice unitPrice={Number(Number.isFinite(displayPrice) ? displayPrice : 0)} sale={sale} />
                        </p>
                        <p className="mt-2 text-xs text-[var(--bokmoo-copy)]">{profile.planBadge}</p>
                        <button
                          onClick={() => onAddToCart(product.id)}
                          className={GOLD_BUTTON_CLASS}
                          type="button"
                        >
                          {t({ en: 'Buy Now', hans: '立即购买', hant: '立即購買' })}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {displayTotalPages > 1 ? (
          <nav
            className="mt-10 flex items-center justify-center gap-2"
            aria-label={t({ en: 'Catalog pages', hans: '目录页码', hant: '目錄頁碼', ja: 'カタログのページ', ko: '카탈로그 페이지', fr: 'Pages du catalogue', de: 'Katalogseiten' })}
            data-purpose="catalog-pager"
          >
            <button
              onClick={() => goToPage(pageShown - 1)}
              disabled={pageShown <= 1}
              aria-label={t(PREVIOUS_PAGE)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40"
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span
              className="rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]"
              data-purpose="catalog-page-label"
            >
              {PAGE_LABEL[languageOf(locale)](pageShown, displayTotalPages)}
            </span>
            <button
              onClick={() => goToPage(pageShown + 1)}
              disabled={pageShown >= displayTotalPages}
              aria-label={t(NEXT_PAGE)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40"
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
});

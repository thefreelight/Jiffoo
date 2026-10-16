import { ShopImage as Image } from './shop-image';
import Link from 'next/link';
import { Check, Star, Truck } from 'lucide-react';
import { SECTION_TYPES } from 'shared';
import { categories, messages, productById, products, type Category, type Product } from '@/lib/catalog';
import { localePath, type ShopLocale } from '@/lib/locale';
import type { ThemeSection } from '@/lib/theme';
import { ProductGrid } from './product-grid';
import { ImageCarousel } from './image-carousel';

type Data = { locale: ShopLocale; currency: string; groups: Category[]; items: Product[] };
type RenderProps = { settings: Record<string, unknown>; data: Data };
const text = (value: unknown) => typeof value === 'string' ? value : '';
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const href = (locale: ShopLocale, value: unknown) => {
  const link = text(value);
  return link.startsWith('https:') ? link : localePath(locale, link || '/');
};
const icon = { check: Check, star: Star, truck: Truck };

export const sectionRegistry: Record<(typeof SECTION_TYPES)[number], (props: RenderProps) => React.ReactNode> = {
  'announcement-bar': ({ settings, data }) => text(settings.text) ? <aside className="bg-announcement-bg px-4 py-2 text-center text-[13px] text-announcement-text">
    {settings.link ? <Link href={href(data.locale, settings.link)}>{text(settings.text)}</Link> : text(settings.text)}
  </aside> : null,
  'hero-banner': ({ settings, data }) => (text(settings.image) || text(settings.title) || text(settings.body)) ? <section className={`relative flex aspect-[4/5] items-end overflow-hidden rounded-2xl bg-highlight md:aspect-[16/7] ${settings.image ? 'text-white' : ''}`}>
    {!!settings.image && <><Image src={text(settings.image)} alt={text(settings.alt)} fill sizes="100vw" priority className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" /></>}
    <div className="relative max-w-[620px] p-5 md:p-12">
      {!!settings.title && <h2 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[44px]">{text(settings.title)}</h2>}
      {!!settings.body && <p className="mt-3 max-w-xl text-base">{text(settings.body)}</p>}
      {!!settings.link && <Link href={href(data.locale, settings.link)}
        className={`mt-6 inline-block rounded-md px-6 py-3 ${settings.image ? 'bg-white text-black' : 'bg-action text-action-ink'}`}>{text(settings.buttonLabel) || text(settings.title)}</Link>}
    </div>
  </section> : null,
  'image-carousel': ({ settings, data }) => <ImageCarousel slides={
    (Array.isArray(settings.slides) ? settings.slides : []).filter((raw) => raw && typeof raw === 'object' && (text(raw.image) || text(raw.title))).map((raw) => {
      const slide = raw as Record<string, unknown>;
      return { image: text(slide.image), title: text(slide.title), alt: text(slide.alt),
        link: slide.link ? href(data.locale, slide.link) : undefined };
    })
  } locale={data.locale} />,
  'category-list': ({ settings, data }) => {
    const selected = strings(settings.categoryIds);
    const groups = selected.length ? data.groups.filter((group) => selected.includes(group.id)) : data.groups;
    if (!groups.length) return null;
    return <section>{!!settings.title && <h2 className="mb-6 text-[22px] font-semibold tracking-tight">{text(settings.title)}</h2>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{groups.map((group) =>
        <Link key={group.id} href={localePath(data.locale, `/categories/${group.slug}`)}
          className="rounded-lg border border-line bg-surface p-5 hover:border-action"><span className="font-medium">{group.name}</span><p className="mt-1 text-[13px] text-subtle">{messages(data.locale).shop.count.replace('{count}', String(group.productCount))}</p></Link>)}</div>
    </section>;
  },
  'product-grid': ({ settings, data }) => {
    if (!data.items.length) return null;
    const category = data.groups.find((group) => group.id === settings.categoryId);
    const target = settings.source === 'latest' ? '/products'
      : settings.source === 'category' && category ? `/categories/${category.slug}` : null;
    return <section>
      {(text(settings.title) || target) && <div className="mb-6 flex items-end justify-between gap-4">
        {!!settings.title && <h2 className="text-[22px] font-semibold tracking-tight">{text(settings.title)}</h2>}
        {target && <Link href={localePath(data.locale, target)} className="ml-auto text-sm text-subtle hover:text-ink">{messages(data.locale).shop.viewAllShort}</Link>}
      </div>}
      <ProductGrid items={data.items.slice(0, typeof settings.count === 'number' ? settings.count : 12)}
        columns={typeof settings.columns === 'number' ? settings.columns : 4}
        locale={data.locale} currency={data.currency} />
    </section>;
  },
  'image-with-text': ({ settings, data }) => (text(settings.title) || text(settings.body) || text(settings.image)) ? <section className={`grid overflow-hidden rounded-2xl border border-line ${settings.image ? 'md:grid-cols-2' : ''}`}>
    {!!settings.image && <div className={`relative aspect-square bg-highlight ${settings.position === 'right' ? 'md:order-2' : ''}`}>
      <Image src={text(settings.image)} alt={text(settings.alt)} fill sizes="(max-width: 720px) 100vw, 50vw" className="object-cover" />
    </div>}
    <div className="self-center p-6 md:p-12">{!!settings.title && <h2 className="text-[28px] font-semibold tracking-tight">{text(settings.title)}</h2>}
      <p className="mt-3 whitespace-pre-wrap text-subtle">{text(settings.body)}</p>
      {!!settings.link && <Link href={href(data.locale, settings.link)} className="mt-4 inline-flex h-10 items-center rounded-md border border-line px-4">{text(settings.title)}</Link>}
    </div>
  </section> : null,
  'text-block': ({ settings }) => (text(settings.title) || text(settings.body)) ? <section>{!!settings.title && <h2 className="text-[22px] font-semibold">{text(settings.title)}</h2>}
    {!!settings.body && <p className="mt-3 whitespace-pre-wrap text-subtle">{text(settings.body)}</p>}</section> : null,
  'feature-list': ({ settings }) => <section className="grid gap-6 md:grid-cols-3">
    {(Array.isArray(settings.items) ? settings.items : []).map((raw, index) => {
      const item = raw as Record<string, unknown>;
      if (!text(item.title) && !text(item.body)) return null;
      const Icon = icon[text(item.icon) as keyof typeof icon] ?? Check;
      return <div key={index} className="rounded-lg border border-line p-6"><Icon aria-hidden="true" className="text-action" />
        <h2 className="mt-2 font-semibold">{text(item.title)}</h2><p className="text-subtle">{text(item.body)}</p></div>;
    })}
  </section>,
};

export function SectionRenderer({ section, data }: { section: ThemeSection; data: Data }) {
  if (!(section.type in sectionRegistry)) {
    console.error('Unknown Shop theme section', section.type);
    return null;
  }
  const render = sectionRegistry[section.type as keyof typeof sectionRegistry];
  if (section.type === 'feature-list' && (!Array.isArray(section.settings.items) || !section.settings.items.some((item) => item && typeof item === 'object' && (text(item.title) || text(item.body))))) return null;
  if (section.type === 'image-carousel' && (!Array.isArray(section.settings.slides) || !section.settings.slides.some((slide) => slide && typeof slide === 'object' && (text(slide.image) || text(slide.title))))) return null;
  const content = render({ settings: section.settings, data });
  return content ? <div data-section={section.type}>{content}</div> : null;
}

export async function ThemeSections({ sections, locale, currency, groups, items }: {
  sections: ThemeSection[]; locale: ShopLocale; currency: string;
  groups?: Category[]; items?: Product[];
}) {
  const resolvedGroups = groups ?? await categories(locale);
  const content = await Promise.all(sections.map(async (section) => {
    if (section.type !== 'product-grid') return { section, products: items ?? [] };
    const { source, categoryId, productIds, count } = section.settings;
    const limit = typeof count === 'number' ? count : 12;
    if (source === 'manual') {
      const ids = strings(productIds);
      const selected = await Promise.all(ids.slice(0, limit).map((id) =>
        items?.find((item) => item.id === id) ?? productById(locale, id)));
      return { section, products: selected.filter((item): item is Product => item !== null) };
    }
    if (source === 'category') {
      if (!text(categoryId)) return { section, products: [] };
      const found = await products(locale, 1, text(categoryId), limit);
      return { section, products: found?.items ?? [] };
    }
    const found = items ? { items } : await products(locale, 1, undefined, limit);
    return { section, products: found?.items ?? [] };
  }));
  return <>{content.map(({ section, products: selected }) =>
    <SectionRenderer key={section.id} section={section}
      data={{ locale, currency, groups: resolvedGroups, items: selected }} />)}</>;
}

import Image from 'next/image';
import Link from 'next/link';
import { Check, Star, Truck } from 'lucide-react';
import { SECTION_TYPES } from 'shared';
import { categories, productById, products, type Category, type Product } from '@/lib/catalog';
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
  'announcement-bar': ({ settings, data }) => <aside className="bg-announcement-bg px-4 py-3 text-center text-announcement-text">
    {settings.link ? <Link href={href(data.locale, settings.link)}>{text(settings.text)}</Link> : text(settings.text)}
  </aside>,
  'hero-banner': ({ settings, data }) => <section className="relative min-h-64 overflow-hidden bg-highlight">
    {!!settings.image && <Image src={text(settings.image)} alt={text(settings.alt)} fill unoptimized className="object-cover" />}
    <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-8">
      <h2 className="text-3xl font-semibold">{text(settings.title)}</h2>
      {!!settings.body && <p className="mt-3 max-w-xl">{text(settings.body)}</p>}
      {!!settings.link && <Link href={href(data.locale, settings.link)}
        className="mt-6 inline-block rounded-shop bg-action px-5 py-3 text-action-ink">{text(settings.buttonLabel) || text(settings.title)}</Link>}
    </div>
  </section>,
  'image-carousel': ({ settings, data }) => <ImageCarousel slides={
    (Array.isArray(settings.slides) ? settings.slides : []).map((raw) => {
      const slide = raw as Record<string, unknown>;
      return { image: text(slide.image), title: text(slide.title), alt: text(slide.alt),
        link: slide.link ? href(data.locale, slide.link) : undefined };
    })
  } />,
  'category-list': ({ settings, data }) => {
    const selected = strings(settings.categoryIds);
    const groups = selected.length ? data.groups.filter((group) => selected.includes(group.id)) : data.groups;
    return <section><h2 className="mb-5 text-2xl font-semibold">{text(settings.title)}</h2>
      <div className="flex flex-wrap gap-3">{groups.map((group) =>
        <Link key={group.id} href={localePath(data.locale, `/categories/${group.slug}`)}
          className="rounded-shop border border-line bg-surface px-4 py-3 font-medium hover:border-action hover:text-action">{group.name}</Link>)}</div>
    </section>;
  },
  'product-grid': ({ settings, data }) => <section>
    <h2 className="mb-5 text-2xl font-semibold">{text(settings.title)}</h2>
    <ProductGrid items={data.items.slice(0, typeof settings.count === 'number' ? settings.count : 12)}
      columns={typeof settings.columns === 'number' ? settings.columns : 4}
      locale={data.locale} currency={data.currency} />
  </section>,
  'image-with-text': ({ settings, data }) => <section className="grid gap-6 md:grid-cols-2">
    <div className={`relative aspect-[4/3] bg-highlight ${settings.position === 'right' ? 'md:order-2' : ''}`}>
      <Image src={text(settings.image)} alt={text(settings.alt)} fill unoptimized className="object-cover" />
    </div>
    <div className="self-center"><h2 className="text-2xl font-semibold">{text(settings.title)}</h2>
      <p className="mt-3 whitespace-pre-wrap text-subtle">{text(settings.body)}</p>
      {!!settings.link && <Link href={href(data.locale, settings.link)} className="mt-4 inline-block text-action underline">{text(settings.title)}</Link>}
    </div>
  </section>,
  'text-block': ({ settings }) => <section><h2 className="text-2xl font-semibold">{text(settings.title)}</h2>
    <p className="mt-3 whitespace-pre-wrap text-subtle">{text(settings.body)}</p></section>,
  'feature-list': ({ settings }) => <section className="grid gap-5 md:grid-cols-3">
    {(Array.isArray(settings.items) ? settings.items : []).map((raw, index) => {
      const item = raw as Record<string, unknown>;
      const Icon = icon[text(item.icon) as keyof typeof icon] ?? Check;
      return <div key={index}><Icon aria-hidden="true" className="text-action" />
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
  return <div data-section={section.type}>{render({ settings: section.settings, data })}</div>;
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

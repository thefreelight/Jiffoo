import Link from 'next/link';
import type { ShopLocale } from '@/lib/locale';
import { localePath } from '@/lib/locale';
import type { ShopTheme } from '@/lib/theme';

export function Footer({ locale, columns }: {
  locale: ShopLocale;
  columns: ShopTheme['layout']['footer']['columns'];
}) {
  if (!columns.length) return null;
  return <footer className="border-t border-line bg-footer-bg px-4 py-10 text-footer-text md:px-8">
    <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {columns.map((column, index) => <section key={`${column.title}-${index}`}>
        <h2 className="font-semibold">{column.title}</h2>
        {column.text && <p className="mt-2 text-sm text-subtle">{column.text}</p>}
        <ul className="mt-3 space-y-2 text-sm">{column.links.map((link, linkIndex) =>
          <li key={`${link.href}-${linkIndex}`}>{link.href.startsWith('https:')
            ? <a href={link.href} rel="noopener noreferrer" className="hover:text-action">{link.label}</a>
            : <Link href={localePath(locale, link.href)} className="hover:text-action">{link.label}</Link>}</li>)}</ul>
      </section>)}
    </div>
  </footer>;
}

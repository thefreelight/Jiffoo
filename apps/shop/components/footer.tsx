import Link from 'next/link';
import { PluginNavigation } from './plugin-navigation';
import type { ShopLocale } from '@/lib/locale';
import { localePath } from '@/lib/locale';
import type { ShopTheme } from '@/lib/theme';

export function Footer({ locale, columns }: {
  locale: ShopLocale;
  columns: ShopTheme['layout']['footer']['columns'];
}) {
  const configured = columns.filter((column) => column.text || column.links.length);
  const layout = configured.length === 1 ? 'md:grid-cols-1' : configured.length === 2 ? 'md:grid-cols-[2fr_1fr]' : configured.length === 3 ? 'md:grid-cols-[2fr_1fr_1fr]' : 'md:grid-cols-[2fr_1fr_1fr_1fr]';
  return <footer className="mt-6 border-t border-line bg-[var(--shop-extras-footer-bg)] pb-8 pt-12 text-[var(--shop-extras-footer-text)]">
    <PluginNavigation locale={locale} placement="footer" />
    <div className={`mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 md:px-8 ${layout}`}>
      {configured.map((column, index) => <section key={`${column.title}-${index}`} className={index === 0 && column.text ? 'col-span-2 md:col-span-1' : ''}>
        <h2 className="text-[13px] font-semibold">{column.title}</h2>
        {column.text && <p className="mt-2 text-sm text-subtle">{column.text}</p>}
        <ul className="mt-3 space-y-2 text-[13px] text-subtle">{column.links.map((link, linkIndex) =>
          <li key={`${link.href}-${linkIndex}`}>{link.href.startsWith('https:')
            ? <a href={link.href} rel="noopener noreferrer" className="hover:text-action">{link.label}</a>
            : <Link href={localePath(locale, link.href)} className="hover:text-action">{link.label}</Link>}</li>)}</ul>
      </section>)}
    </div>
  </footer>;
}

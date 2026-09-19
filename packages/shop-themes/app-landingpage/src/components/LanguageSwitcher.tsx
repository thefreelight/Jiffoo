import React, { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import type { Locale } from '../types/i18n';
import { THEME_LOCALES, getThemeLocaleOption, stripLocalePrefix } from '../lib/locales';

interface LanguageSwitcherProps {
  currentLocale?: Locale;
  /** dropdown = compact globe button with a panel (header); inline = wrapped link row (footer, mobile menus) */
  variant?: 'dropdown' | 'inline';
}

function localeHref(code: Locale): string {
  if (typeof window === 'undefined') {
    return `/${code}`;
  }
  const pathname = window.location.pathname;
  const query = window.location.search;
  const pathWithoutLocale = stripLocalePrefix(pathname);
  return `/${code}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}${query}`;
}

/**
 * Language switcher for the storefront chrome.
 *
 * The locale list comes from THEME_LOCALES so adding a language is a
 * data change, not a markup change.
 */
export function LanguageSwitcher({ currentLocale, variant = 'dropdown' }: LanguageSwitcherProps) {
  const current = getThemeLocaleOption((currentLocale ?? 'en') as Locale);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || variant !== 'dropdown') {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, variant]);

  const linkClassName = (isActive: boolean) =>
    `transition hover:text-[var(--esim-primary)] ${isActive ? 'text-[var(--esim-primary)]' : 'text-[var(--esim-ink-soft)]'}`;

  if (variant === 'inline') {
    return (
      <nav aria-label="Language" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-black text-[var(--esim-ink-soft)]">
        {THEME_LOCALES.map((item) => (
          <a
            key={item.code}
            href={localeHref(item.code)}
            aria-current={item.code === current.code ? 'page' : undefined}
            className={linkClassName(item.code === current.code)}
          >
            {item.nativeName}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Language"
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--esim-line)] bg-[var(--esim-surface-cool)] px-4 text-sm font-extrabold text-[var(--esim-ink)] transition hover:border-[var(--esim-primary)] hover:text-[var(--esim-primary)]"
      >
        <Globe className="h-4 w-4" />
        <span>{current.label}</span>
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          aria-label="Language"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-[var(--esim-line)] bg-white py-1.5 shadow-[0_18px_48px_rgb(15_55_110_/_0.16)]"
        >
          {THEME_LOCALES.map((item) => (
            <li key={item.code} role="option" aria-selected={item.code === current.code}>
              <a
                href={localeHref(item.code)}
                aria-current={item.code === current.code ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-4 py-2 text-sm font-bold transition hover:bg-[var(--esim-primary-soft)] hover:text-[var(--esim-primary)] ${
                  item.code === current.code ? 'text-[var(--esim-primary)]' : 'text-[var(--esim-ink)]'
                }`}
              >
                <span>{item.nativeName}</span>
                <span className="text-xs font-black text-[var(--esim-muted)]">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default LanguageSwitcher;

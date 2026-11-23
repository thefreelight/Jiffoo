'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { resolveRequestLocale } from '@/lib/request-locale';
import type { Locale } from 'shared/src/i18n';

type Copy = { title: string; body: string; home: string };

const COPY: Record<Locale, Copy> = {
  en: { title: 'Page Not Found', body: "Sorry, we couldn't find the page you're looking for.", home: 'Back to Home' },
  'zh-Hans': { title: '页面不存在', body: '抱歉，找不到您要访问的页面。', home: '返回首页' },
  'zh-Hant': { title: '頁面不存在', body: '抱歉，找不到您要存取的頁面。', home: '返回首頁' },
  ja: { title: 'ページが見つかりません', body: 'お探しのページは見つかりませんでした。', home: 'ホームに戻る' },
  ko: { title: '페이지를 찾을 수 없어요', body: '찾으시는 페이지를 찾을 수 없어요.', home: '홈으로' },
  fr: { title: 'Page introuvable', body: 'Désolé, la page est introuvable.', home: 'Retour à l’accueil' },
  de: { title: 'Seite nicht gefunden', body: 'Leider konnte die Seite nicht gefunden werden.', home: 'Zurück zur Startseite' },
};

/**
 * 404 for URLs that match no route at all. It renders in the root layout,
 * outside the locale segment, so there is no theme and no I18nProvider here;
 * the copy is resolved from the URL and the browser's languages instead.
 * "404" is the only thing rendered on the server — it reads the same in
 * every language and keeps hydration mismatch-free — the text follows on mount.
 */
export function GlobalNotFound() {
  const pathname = usePathname();
  const [locale, setLocale] = React.useState<Locale>('en');

  React.useEffect(() => {
    setLocale(resolveRequestLocale(pathname, typeof navigator === 'undefined' ? [] : navigator.languages));
  }, [pathname]);

  const copy = COPY[locale];
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-24 text-center">
      <div className="max-w-md">
        <p className="text-7xl font-bold tracking-tight text-slate-200 sm:text-9xl dark:text-slate-700">404</p>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{copy.title}</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-gray-400 sm:text-base">{copy.body}</p>
        <a
          href={`/${locale}`}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          {copy.home}
        </a>
      </div>
    </main>
  );
}

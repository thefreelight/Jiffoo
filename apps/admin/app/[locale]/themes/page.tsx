'use client';

import { ThemesManager } from '@/components/extensions/ThemesManager';
import { useT } from 'shared/src/i18n/react';

export default function ThemesPage() {
  const t = useT();

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return (
    <div className="w-full min-h-screen bg-[#fcfdfe]">
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-none tracking-tight text-gray-900">
            {getText('merchant.themes.management', 'Themes')}
          </h1>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">
            {getText('merchant.themes.subtitle', 'Storefront themes, activation status, and official marketplace.')}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        <ThemesManager />
      </div>
    </div>
  );
}

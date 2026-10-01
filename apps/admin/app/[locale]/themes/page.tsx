'use client';

import { ThemesManager } from '@/components/extensions/ThemesManager';
import { useManagedMode } from '@/lib/managed-mode';
import { useT } from 'shared/src/i18n/react';
import { PageShell } from '@/components/layout/page-shell'

export default function ThemesPage() {
  return <ThemesPageContent />;
}

function ThemesPageContent() {
  const t = useT();
  const { record } = useManagedMode();

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return (
    <PageShell
      title={
        record
          ? getText('merchant.themes.licensedThemeCenter', 'Licensed themes')
          : getText('merchant.themes.management', 'Themes')
      }
      description={
        record
          ? getText('merchant.themes.subtitleManaged', 'Package-approved storefront themes and activation controls.')
          : getText('merchant.themes.subtitle', 'Storefront themes, activation status, and official marketplace.')
      }
    >
      <ThemesManager />
    </PageShell>
  );
}

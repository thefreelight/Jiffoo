'use client';

import { PluginsManager } from '@/components/extensions/PluginsManager';
import { useManagedMode } from '@/lib/managed-mode';
import { useT } from 'shared/src/i18n/react';
import { PageShell } from '@/components/layout/page-shell'

export default function PluginsPage() {
  return <PluginsPageContent />;
}

function PluginsPageContent() {
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
          ? getText('merchant.plugins.licensedPluginCenter', 'Licensed plugins')
          : getText('merchant.plugins.management', 'Plugins')
      }
      description={
        record
          ? getText('merchant.plugins.subtitleManaged', 'Package-approved plugins and settings in one place.')
          : getText('merchant.plugins.subtitle', 'Installed apps, official marketplace, and settings in one place.')
      }
    >
      <PluginsManager />
    </PageShell>
  );
}

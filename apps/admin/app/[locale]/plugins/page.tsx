'use client';

import { PluginsManager } from '@/components/extensions/PluginsManager';
import { useManagedMode } from '@/lib/managed-mode';
import { useT } from 'shared/src/i18n/react';

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
    <div className="w-full min-h-screen bg-[#fcfdfe]">
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-none tracking-tight text-gray-900">
            {record
              ? getText('merchant.plugins.licensedPluginCenter', 'Licensed plugins')
              : getText('merchant.plugins.management', 'Plugins')}
          </h1>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">
            {record
              ? getText('merchant.plugins.subtitleManaged', 'Package-approved plugins and settings in one place.')
              : getText('merchant.plugins.subtitle', 'Installed apps, official marketplace, and settings in one place.')}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        <PluginsManager />
      </div>
    </div>
  );
}

'use client';

import { PluginsManager } from '@/components/extensions/PluginsManager';

export default function PluginsPage() {
  return <PluginsPageContent />;
}

function PluginsPageContent() {
  return (
    <div className="min-h-screen w-full bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-8 lg:px-10">
        <PluginsManager />
      </div>
    </div>
  );
}

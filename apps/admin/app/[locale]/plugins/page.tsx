'use client';

import { PluginsManager } from '@/components/extensions/PluginsManager';

export default function PluginsPage() {
  return <PluginsPageContent />;
}

function PluginsPageContent() {
  return (
    <div className="w-full min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <PluginsManager />
      </div>
    </div>
  );
}

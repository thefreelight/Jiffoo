'use client';

import { ThemesManager } from '@/components/extensions/ThemesManager';

export default function ThemesPage() {
  return <ThemesPageContent />;
}

function ThemesPageContent() {
  return (
    <div className="w-full min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <ThemesManager />
      </div>
    </div>
  );
}

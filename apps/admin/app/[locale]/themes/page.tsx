'use client';

import { ThemesManager } from '@/components/extensions/ThemesManager';

export default function ThemesPage() {
  return <ThemesPageContent />;
}

function ThemesPageContent() {
  return (
    <div className="min-h-screen w-full bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-[1540px] px-5 py-6 sm:px-8 lg:px-10">
        <ThemesManager />
      </div>
    </div>
  );
}

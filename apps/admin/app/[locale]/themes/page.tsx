/**
 * Themes page — the theme marketplace (reference design layout).
 */

'use client';

import { ThemeMarketplace } from '@/components/extensions/ThemeMarketplace';
import { PageShell } from '@/components/layout/page-shell';

export default function ThemesPage() {
  return (
    <PageShell>
      <ThemeMarketplace />
    </PageShell>
  );
}

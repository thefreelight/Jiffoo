'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'shared/src/i18n/react';
import { Menu } from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { ThemeAssets } from '@/lib/theme-assets';
import { usePreferences } from '@/lib/preferences-provider';
import { shellCopy } from '@/lib/shell-copy';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AdminNavigation } from './admin-navigation';
import { TestSigningBanner } from './TestSigningBanner';
import { isPublicAdminRoute } from './public-routes';
export function AdminShell({ children, logo = null, loginBackground = null, storeName = '', storeUrl = '' }: {
  children: React.ReactNode; logo?: string | null; loginBackground?: string | null; storeName?: string; storeUrl?: string;
}) {
  const pathname = usePathname(), locale = useLocale();
  const { collapsed } = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const copy = shellCopy[locale];
  const navigation = { storeName, storeUrl, logo };
  return <ThemeAssets.Provider value={{ logo, loginBackground }}>{isPublicAdminRoute(pathname) ? children :
    <ProtectedRoute requireAdmin><TooltipProvider delayDuration={200}>
      <div className="flex h-dvh overflow-hidden bg-background text-foreground">
        <aside aria-label={copy.navigation} className="hidden shrink-0 border-r border-border min-[769px]:flex" style={{ width: collapsed ? 56 : 240 }}><AdminNavigation {...navigation} collapsed={collapsed} /></aside>
        <button type="button" aria-label="Open menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-60 flex size-8 items-center justify-center rounded-md border bg-raised text-foreground min-[769px]:hidden"><Menu className="size-4" aria-hidden="true" /></button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent closeLabel={copy.closeMenu}>
          <SheetTitle className="sr-only">{copy.navigation}</SheetTitle><SheetDescription className="sr-only">{storeName || copy.store}</SheetDescription>
          <AdminNavigation {...navigation} mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent></Sheet>
        <main id="main" tabIndex={-1} className="admin-main min-w-0 flex-1 overflow-y-auto bg-background"><div className="mx-auto min-h-full max-w-[1120px] px-8 pt-10 pb-8"><TestSigningBanner />{children}</div></main>
      </div>
    </TooltipProvider></ProtectedRoute>}
  </ThemeAssets.Provider>;
}

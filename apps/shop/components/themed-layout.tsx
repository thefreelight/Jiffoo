'use client';

/**
 * Themed Layout Component
 *
 * Renders the theme-based header, footer, and main content area.
 * Provides i18n support by passing the translation function to theme components.
 */

import { useShopTheme } from '@/lib/themes/provider';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useTenantNavigation } from '@/hooks/use-tenant-navigation';
import { useT, useLocale } from 'shared/src/i18n';

interface ThemedLayoutProps {
  children: React.ReactNode;
}

/**
 * Themed Layout Component
 *
 * This component renders the header, footer, and main content area
 * using components from the current theme package.
 * It handles all the theme-related layout logic that was previously in ConditionalLayout.
 */
export function ThemedLayout({ children }: ThemedLayoutProps) {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { cart } = useCartStore();
  const tenantNav = useTenantNavigation();
  const t = useT();
  const locale = useLocale();

  // Show loading state while theme is loading
  if (themeLoading || !theme) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Get Header and Footer components from theme
  const HeaderComponent = theme?.components?.Header;
  const FooterComponent = theme?.components?.Footer;

  // Ensure theme components are available
  if (!HeaderComponent || !FooterComponent) {
    throw new Error('Theme package must provide Header and Footer components');
  }

  // Prepare Header props with i18n support
  const headerProps = {
    isAuthenticated,
    user: user ? {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    } : undefined,
    cartItemCount: cart.itemCount,
    config,
    locale,
    t,
    onSearch: (query: string) => {
      tenantNav.push(`/search?q=${encodeURIComponent(query)}`);
    },
    onNavigate: (path: string) => {
      tenantNav.push(path);
    },
    onLogout: () => {
      logout();
      tenantNav.push('/');
    },
    onLogin: () => {
      tenantNav.push('/auth/login');
    },
    onNavigateToCart: () => {
      tenantNav.push('/cart');
    },
    onNavigateToProfile: () => {
      tenantNav.push('/profile');
    },
    onNavigateToLogin: () => {
      tenantNav.push('/auth/login');
    },
    onNavigateToRegister: () => {
      tenantNav.push('/auth/register');
    },
    onNavigateToHome: () => {
      tenantNav.push('/');
    },
    onNavigateToProducts: () => {
      tenantNav.push('/products');
    },
    onNavigateToCategories: () => {
      tenantNav.push('/categories');
    },
    onNavigateToDeals: () => {
      tenantNav.push('/deals');
    },
  };

  // Prepare Footer props with i18n support
  const footerProps = {
    config,
    locale,
    t,
    onNavigate: (path: string) => {
      tenantNav.push(path);
    },
    onNavigateToProducts: () => {
      tenantNav.push('/products');
    },
    onNavigateToCategories: () => {
      tenantNav.push('/categories');
    },
    onNavigateToDeals: () => {
      tenantNav.push('/deals');
    },
    onNavigateToNewArrivals: () => {
      tenantNav.push('/new-arrivals');
    },
    onNavigateToBestsellers: () => {
      tenantNav.push('/bestsellers');
    },
    onNavigateToHelp: () => {
      tenantNav.push('/help');
    },
    onNavigateToContact: () => {
      tenantNav.push('/contact');
    },
    onNavigateToPrivacy: () => {
      tenantNav.push('/privacy');
    },
    onNavigateToTerms: () => {
      tenantNav.push('/terms');
    },
  };

  // Render themed layout with header, footer, and main content
  return (
    <div className="relative flex min-h-screen flex-col">
      <HeaderComponent {...headerProps} />
      <main className="flex-1">{children}</main>
      <FooterComponent {...footerProps} />
    </div>
  );
}

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
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT, useLocale } from 'shared/src/i18n/react';

interface ThemedLayoutProps {
  children: React.ReactNode;
}

/**
 * Themed Layout Component
 *
 * This component renders the header, footer, and main content area
 * using components from the current theme package.
 * It handles all the theme-related layout logic.
 */
export function ThemedLayout({ children }: ThemedLayoutProps) {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { cart } = useCartStore();
  const { push } = useLocalizedNavigation();
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
      push(`/search?q=${encodeURIComponent(query)}`);
    },
    onNavigate: (path: string) => {
      push(path);
    },
    onLogout: () => {
      logout();
      push('/');
    },
    onLogin: () => {
      push('/auth/login');
    },
    onNavigateToCart: () => {
      push('/cart');
    },
    onNavigateToProfile: () => {
      push('/profile');
    },
    onNavigateToLogin: () => {
      push('/auth/login');
    },
    onNavigateToRegister: () => {
      push('/auth/register');
    },
    onNavigateToHome: () => {
      push('/');
    },
    onNavigateToProducts: () => {
      push('/products');
    },
    onNavigateToCategories: () => {
      push('/categories');
    },
    onNavigateToDeals: () => {
      push('/deals');
    },
  };

  // Prepare Footer props with i18n support
  const footerProps = {
    config,
    locale,
    t,
    onNavigate: (path: string) => {
      push(path);
    },
    onNavigateToProducts: () => {
      push('/products');
    },
    onNavigateToCategories: () => {
      push('/categories');
    },
    onNavigateToDeals: () => {
      push('/deals');
    },
    onNavigateToNewArrivals: () => {
      push('/new-arrivals');
    },
    onNavigateToBestsellers: () => {
      push('/bestsellers');
    },
    onNavigateToHelp: () => {
      push('/help');
    },
    onNavigateToContact: () => {
      push('/contact');
    },
    onNavigateToPrivacy: () => {
      push('/privacy');
    },
    onNavigateToTerms: () => {
      push('/terms');
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

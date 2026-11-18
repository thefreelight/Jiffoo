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
import { useStoreContext } from '@/store/store';
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
  const storeContext = useStoreContext();
  const { push } = useLocalizedNavigation();
  const t = useT();
  const locale = useLocale();

  // While the theme renderer loads (remote runtimes load client-side),
  // render the page content itself: crawlers and first paint get real
  // content instead of a bare skeleton. The themed header/footer/content
  // take over once the theme is ready.
  if (themeLoading || !theme) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="container mx-auto px-4 py-8">{children}</main>
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
    platformBranding: storeContext?.platformBranding,
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
      <main id="main" className="flex-1" tabIndex={-1}>{children}</main>
      <FooterComponent {...footerProps} />
    </div>
  );
}

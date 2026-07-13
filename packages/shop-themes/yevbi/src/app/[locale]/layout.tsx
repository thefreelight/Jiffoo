'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { ThemeProvider } from '../../components/ThemeProvider';
import { authApi, cartApi } from '../../lib/api';

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = (params?.locale as string) || 'en';

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; firstName?: string; username?: string } | undefined>();
  const [cartItemCount, setCartItemCount] = useState(0);

  // Check authentication status - recheck on pathname change and storage events
  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = authApi.isAuthenticated();
      setIsAuthenticated(isAuth);
      if (isAuth) {
        try {
          const profile = await authApi.getProfile();
          setUser({
            id: profile.id,
            email: profile.email,
            firstName: profile.username, // Use username as display name
            username: profile.username,
          });
        } catch (error) {
          console.error('Failed to get profile:', error);
          // Token might be invalid, clear auth state
          setIsAuthenticated(false);
          setUser(undefined);
        }
      } else {
        setUser(undefined);
      }
    };

    checkAuth();

    // Listen for storage changes (login/logout in other tabs or same tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === null) {
        checkAuth();
      }
    };

    // Custom event for same-tab auth changes
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, [pathname]);

  // Get cart count
  useEffect(() => {
    const fetchCartCount = async () => {
      if (!isAuthenticated) {
        setCartItemCount(0);
        return;
      }
      try {
        const cart = await cartApi.getCart();
        const count = cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        setCartItemCount(count);
      } catch (error) {
        console.error('Failed to get cart:', error);
      }
    };

    fetchCartCount();

    // Listen for cart update events
    const handleCartUpdate = () => {
      fetchCartCount();
    };

    window.addEventListener('cart-updated', handleCartUpdate);

    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, [isAuthenticated]);

  // Navigation helpers
  const handleNavigate = (path: string) => {
    router.push(`/${locale}${path}`);
  };

  const handleSearch = (query: string) => {
    router.push(`/${locale}/search?q=${encodeURIComponent(query)}`);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      setIsAuthenticated(false);
      setUser(undefined);
      setCartItemCount(0);
      router.push(`/${locale}`);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Determine if we're on the home page for transparent header
  const isHomePage = pathname === `/${locale}` || pathname === `/${locale}/`;
  // Auth pages get their own minimal header/footer — skip the global ones
  const isAuthPage = pathname.includes('/auth/');

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
        {!isAuthPage && (
          <Header
            isAuthenticated={isAuthenticated}
            user={user}
            cartItemCount={cartItemCount}
            onSearch={handleSearch}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onNavigateToCart={() => handleNavigate('/cart')}
            onNavigateToProfile={() => handleNavigate('/profile')}
            onNavigateToLogin={() => handleNavigate('/auth/login')}
            onNavigateToRegister={() => handleNavigate('/auth/register')}
            onNavigateToHome={() => router.push(`/${locale}`)}
            onNavigateToProducts={() => handleNavigate('/products')}
            onNavigateToCategories={() => handleNavigate('/products')}
            onNavigateToDeals={() => handleNavigate('/products')}
            variant={isHomePage ? 'transparent' : 'solid'}
          />
        )}

        {/* Main content — no top padding on auth pages (they control their own layout) */}
        <main className={`flex-1 ${isAuthPage ? '' : isHomePage ? '' : 'pt-[104px] lg:pt-32'}`}>
          {children}
        </main>

        {!isAuthPage && (
          <Footer
            onNavigate={handleNavigate}
            onNavigateToProducts={() => handleNavigate('/products')}
            onNavigateToCategories={() => handleNavigate('/products')}
            onNavigateToDeals={() => handleNavigate('/products')}
            onNavigateToNewArrivals={() => handleNavigate('/products')}
            onNavigateToBestsellers={() => handleNavigate('/products')}
            onNavigateToHelp={() => handleNavigate('/help')}
            onNavigateToContact={() => handleNavigate('/contact')}
            onNavigateToPrivacy={() => handleNavigate('/privacy')}
            onNavigateToTerms={() => handleNavigate('/terms')}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

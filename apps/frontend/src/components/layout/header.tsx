'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart, User, Menu, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/hooks/use-translation';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { cn } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const { currentLanguage } = useTranslation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { cart, toggleCart, fetchCart } = useCartStore();

  // Initialize cart on component mount
  React.useEffect(() => {
    fetchCart().catch(console.error);
  }, [fetchCart]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // 简单的翻译映射
  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      searchPlaceholder: 'Search products...',
      products: 'Products',
      categories: 'Categories',
      deals: 'Deals',
      login: 'Login',
      signUp: 'Sign Up',
      logout: 'Logout',
    },
    'zh-CN': {
      searchPlaceholder: '搜索商品...',
      products: '商品',
      categories: '分类',
      deals: '优惠',
      login: '登录',
      signUp: '注册',
      logout: '退出',
    },
    'ja-JP': {
      searchPlaceholder: '商品を検索...',
      products: '商品',
      categories: 'カテゴリー',
      deals: 'セール',
      login: 'ログイン',
      signUp: '新規登録',
      logout: 'ログアウト',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">J</span>
            </div>
            <span className="font-bold text-xl text-gradient">Jiffoo</span>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearch} className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </form>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/products"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('products')}
            </Link>
            <Link
              href="/categories"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('categories')}
            </Link>
            <Link
              href="/deals"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('deals')}
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <div className="hidden sm:flex">
              <LanguageSwitcher />
            </div>

            {/* Wishlist */}
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Heart className="h-4 w-4" />
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/cart')}
              className="relative"
            >
              <ShoppingCart className="h-4 w-4" />
              {cart.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {cart.itemCount}
                </span>
              )}
            </Button>

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push('/profile')}
                  title="Profile"
                >
                  <User className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="hidden sm:flex"
                >
                  {t('logout')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/auth/login')}
                  className="hidden sm:flex"
                >
                  {t('login')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push('/auth/register')}
                  className="hidden sm:flex"
                >
                  {t('signUp')}
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-4">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />
          </form>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t py-4">
            <nav className="flex flex-col space-y-4">
              <Link
                href="/products"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('products')}
              </Link>
              <Link
                href="/categories"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('categories')}
              </Link>
              <Link
                href="/deals"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('deals')}
              </Link>

              <div className="flex flex-col space-y-2 pt-4 border-t">
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        router.push('/profile');
                        setIsMenuOpen(false);
                      }}
                    >
                      Profile
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                    >
                      {t('logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        router.push('/auth/login');
                        setIsMenuOpen(false);
                      }}
                    >
                      {t('login')}
                    </Button>
                    <Button
                      onClick={() => {
                        router.push('/auth/register');
                        setIsMenuOpen(false);
                      }}
                    >
                      {t('signUp')}
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

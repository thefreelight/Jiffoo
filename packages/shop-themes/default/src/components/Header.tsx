/**
 * Header Component
 *
 * Main navigation header with search, cart, and user menu.
 * Supports i18n through the t() translation function prop.
 */

import React from 'react';
import Link from 'next/link';
import { Search, ShoppingCart, User, Menu, Heart } from 'lucide-react';
import type { HeaderProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function Header({
  cartItemCount = 0,
  isAuthenticated = false,
  config,
  t,
  onSearch,
  onNavigateToCart,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onLogout,
  onNavigateToHome,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Helper function to get translated text with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setSearchQuery('');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-900 backdrop-blur supports-[backdrop-filter]:bg-white/95 dark:bg-gray-900/95">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <button
            onClick={onNavigateToHome}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">J</span>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">Jiffoo</span>
          </button>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearch} className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder={getText('shop.nav.searchPlaceholder', 'Search products...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              />
            </form>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            <button
              onClick={onNavigateToProducts}
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {getText('shop.nav.products', 'Products')}
            </button>
            <button
              onClick={onNavigateToCategories}
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {getText('shop.nav.categories', 'Categories')}
            </button>
            <button
              onClick={onNavigateToDeals}
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {getText('shop.nav.deals', 'Deals')}
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Wishlist */}
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Heart className="h-4 w-4" />
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateToCart}
              className="relative"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Button>

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNavigateToProfile}
                  title={getText('shop.header.profile', 'Profile')}
                >
                  <User className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="hidden sm:flex"
                >
                  {getText('shop.header.logout', 'Logout')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNavigateToLogin}
                  className="hidden sm:flex"
                >
                  {getText('shop.header.login', 'Login')}
                </Button>
                <Button
                  size="sm"
                  onClick={onNavigateToRegister}
                  className="hidden sm:flex"
                >
                  {getText('shop.header.signUp', 'Sign Up')}
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder={getText('shop.nav.searchPlaceholder', 'Search products...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            />
          </form>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t py-4">
            <nav className="flex flex-col space-y-4">
              <button
                onClick={() => {
                  onNavigateToProducts();
                  setIsMenuOpen(false);
                }}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-left"
              >
                {getText('shop.nav.products', 'Products')}
              </button>
              <button
                onClick={() => {
                  onNavigateToCategories();
                  setIsMenuOpen(false);
                }}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-left"
              >
                {getText('shop.nav.categories', 'Categories')}
              </button>
              <button
                onClick={() => {
                  onNavigateToDeals();
                  setIsMenuOpen(false);
                }}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-left"
              >
                {getText('shop.nav.deals', 'Deals')}
              </button>

              <div className="flex flex-col space-y-2 pt-4 border-t">
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onNavigateToProfile();
                        setIsMenuOpen(false);
                      }}
                      className="justify-start"
                    >
                      {getText('shop.header.profile', 'Profile')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onLogout();
                        setIsMenuOpen(false);
                      }}
                      className="justify-start"
                    >
                      {getText('shop.header.logout', 'Logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onNavigateToLogin();
                        setIsMenuOpen(false);
                      }}
                      className="justify-start"
                    >
                      {getText('shop.header.login', 'Login')}
                    </Button>
                    <Button
                      onClick={() => {
                        onNavigateToRegister();
                        setIsMenuOpen(false);
                      }}
                      className="justify-start"
                    >
                      {getText('shop.header.signUp', 'Sign Up')}
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


/**
 * Header Component - Jiffoo Admin Style Design
 *
 * Main navigation header with search, cart, and user menu.
 * Supports i18n through the t() translation function prop.
 * Uses Jiffoo Admin Style design system with dark mode support.
 */

import React from 'react';
import { Search, ShoppingCart, User, Menu, X, Moon, Sun } from 'lucide-react';
import { Button, cn } from '@jiffoo/ui';
import { useTheme } from 'next-themes';
import type { HeaderProps } from '../../../../shared/src/types/theme';

export const Header = React.memo(function Header({
  cartItemCount = 0,
  isAuthenticated = false,
  config,
  t,
  onSearch,
  onNavigate,
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
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Track scroll for header shadow
  React.useEffect(() => {
    setMounted(true);
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-[1000] transition-all duration-200',
        'bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl',
        'border-b border-gray-200 dark:border-slate-700',
        isScrolled && 'shadow-sm'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-18 lg:h-20">
          {/* Logo */}
          <button
            onClick={onNavigateToHome}
            className="flex items-center gap-2 sm:gap-3 flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-extrabold text-base sm:text-lg">J</span>
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Jiffoo
            </span>
          </button>

          {/* Desktop Navigation - Centered */}
          <nav className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
            {[
              { label: getText('shop.nav.products', 'Products'), onClick: onNavigateToProducts },
              { label: getText('shop.nav.contact', 'Contact'), onClick: () => onNavigate?.('/contact') },
              { label: getText('shop.nav.help', 'Help'), onClick: () => onNavigate?.('/help') },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  'px-4 py-2 text-sm font-semibold rounded-xl transition-all',
                  'text-gray-600 dark:text-gray-300',
                  'hover:text-blue-600 dark:hover:text-blue-400',
                  'hover:bg-blue-50 dark:hover:bg-slate-800'
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Action Group */}
            <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-1">
              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className={cn(
                    'flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl',
                    'text-gray-600 dark:text-gray-300 transition-all',
                    'hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
                  )}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              )}

              {/* Cart Button */}
              <button
                onClick={onNavigateToCart}
                className={cn(
                  'relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl',
                  'text-gray-600 dark:text-gray-300 transition-all',
                  'hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
                )}
                aria-label="Cart"
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </button>

              {/* User Menu */}
              {isAuthenticated && (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={cn(
                      'flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl transition-all',
                      isUserMenuOpen
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
                    )}
                  >
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 min-w-[200px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 z-50">
                      <button
                        onClick={() => { onNavigateToProfile(); setIsUserMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                      >
                        {getText('shop.header.profile', 'Profile')}
                      </button>
                      <button
                        onClick={() => { onLogout(); setIsUserMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all"
                      >
                        {getText('shop.header.logout', 'Logout')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth Buttons - Desktop */}
            {!isAuthenticated && (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={onNavigateToLogin}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold rounded-xl transition-all',
                    'border border-gray-200 dark:border-slate-700',
                    'text-gray-700 dark:text-gray-300',
                    'hover:border-blue-600 dark:hover:border-blue-400',
                    'hover:text-blue-600 dark:hover:text-blue-400',
                    'hover:bg-blue-50 dark:hover:bg-slate-800'
                  )}
                >
                  {getText('shop.header.login', 'Login')}
                </button>
                <button
                  onClick={onNavigateToRegister}
                  className={cn(
                    'px-4 py-2 text-sm font-bold rounded-xl transition-all',
                    'bg-gradient-to-r from-blue-600 to-blue-500 text-white',
                    'hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5'
                  )}
                >
                  {getText('shop.header.signUp', 'Sign Up')}
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'lg:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl',
                'text-gray-600 dark:text-gray-300 transition-all',
                'hover:bg-gray-100 dark:hover:bg-slate-800'
              )}
              aria-label="Menu"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-slate-700 py-4 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-1">
              {[
                { label: getText('shop.nav.products', 'Products'), onClick: onNavigateToProducts },
                { label: getText('shop.nav.contact', 'Contact'), onClick: () => onNavigate?.('/contact') },
                { label: getText('shop.nav.help', 'Help'), onClick: () => onNavigate?.('/help') },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    item.onClick();
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    'px-4 py-3 text-base font-medium rounded-xl text-left transition-all',
                    'text-gray-700 dark:text-gray-300',
                    'hover:bg-gray-100 dark:hover:bg-slate-800',
                    'active:bg-gray-200 dark:active:bg-slate-700'
                  )}
                >
                  {item.label}
                </button>
              ))}

              <div className="flex flex-col space-y-2 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onNavigateToProfile();
                        setIsMenuOpen(false);
                      }}
                      className="justify-start w-full"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {getText('shop.header.profile', 'Profile')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onLogout();
                        setIsMenuOpen(false);
                      }}
                      className="justify-start w-full text-error-600 hover:text-error-700 hover:bg-error-50"
                    >
                      {getText('shop.header.logout', 'Logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        onNavigateToLogin();
                        setIsMenuOpen(false);
                      }}
                      className="w-full"
                    >
                      {getText('shop.header.login', 'Login')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        onNavigateToRegister();
                        setIsMenuOpen(false);
                      }}
                      className="w-full"
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
});

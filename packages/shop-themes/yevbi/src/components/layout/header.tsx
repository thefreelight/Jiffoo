/**
 * TravelPass Header Component
 * 
 * SDK-compliant component accepting HeaderProps from theme.ts
 */

import type { HeaderProps } from '../../../../../shared/src/types/theme';
import { useState } from 'react';

// Helper for translations with fallback
const getText = (t: HeaderProps['t'], key: string, fallback: string): string => {
  if (!t) return fallback;
  const translated = t(key);
  return translated === key ? fallback : translated;
};

export function Header({
  isAuthenticated,
  user,
  cartItemCount,
  config,
  onSearch,
  onNavigate,
  onLogout,
  onNavigateToCart,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToHome,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
  t,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-black/50 to-transparent">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center">
            <button onClick={onNavigateToHome} className="flex items-center">
              <span className="text-2xl mr-2">🌐</span>
              <span className="font-bold text-xl text-white">TravelPass</span>
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-6">
            <button onClick={onNavigateToProducts} className="text-white hover:text-blue-200 font-medium">
              {getText(t, 'shop.nav.destinations', 'Destinations')}
            </button>
            <button onClick={onNavigateToProducts} className="text-white hover:text-blue-200 font-medium">
              {getText(t, 'shop.nav.packages', 'eSIM Packages')}
            </button>
            <button onClick={() => onNavigate?.('/help')} className="text-white hover:text-blue-200 font-medium">
              {getText(t, 'shop.nav.support', 'Support')}
            </button>
            <button onClick={() => onNavigate?.('/contact')} className="text-white hover:text-blue-200 font-medium">
              {getText(t, 'shop.nav.about', 'About Us')}
            </button>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Cart */}
            <button onClick={onNavigateToCart} className="text-white hover:text-blue-200 relative">
              <span className="text-xl">🛒</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>

            {isAuthenticated ? (
              <>
                <button onClick={onNavigateToProfile} className="text-white hover:text-blue-200 hidden sm:flex items-center">
                  <span className="text-xl mr-1">👤</span>
                  <span className="hidden lg:inline">{user?.firstName || getText(t, 'shop.nav.account', 'Account')}</span>
                </button>
                <button
                  onClick={onLogout}
                  className="text-white hover:text-blue-200 text-sm"
                >
                  {getText(t, 'shop.nav.logout', 'Logout')}
                </button>
              </>
            ) : (
              <button
                onClick={onNavigateToLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition"
              >
                {getText(t, 'shop.nav.signIn', 'Sign In')}
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-white"
            >
              <span className="text-2xl">{isMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-black/80 rounded-lg p-4 mt-2">
            <button onClick={() => { onNavigateToProducts(); setIsMenuOpen(false); }} className="block text-white py-2 w-full text-left">
              {getText(t, 'shop.nav.destinations', 'Destinations')}
            </button>
            <button onClick={() => { onNavigateToProducts(); setIsMenuOpen(false); }} className="block text-white py-2 w-full text-left">
              {getText(t, 'shop.nav.packages', 'eSIM Packages')}
            </button>
            <button onClick={() => { onNavigate?.('/help'); setIsMenuOpen(false); }} className="block text-white py-2 w-full text-left">
              {getText(t, 'shop.nav.support', 'Support')}
            </button>
            <button onClick={() => { onNavigate?.('/contact'); setIsMenuOpen(false); }} className="block text-white py-2 w-full text-left">
              {getText(t, 'shop.nav.about', 'About Us')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;

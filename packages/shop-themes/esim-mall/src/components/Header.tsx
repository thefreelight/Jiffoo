/**
 * TravelPass Header Component
 *
 * SDK-compliant component accepting HeaderProps from theme.ts
 * Styled to match eSIM Mall prototype with Font Awesome icons
 */

import React from 'react';
import type { HeaderProps } from '../types';
import { useState, useEffect } from 'react';

// Helper for translations with fallback
const getText = (t: HeaderProps['t'], key: string, fallback: string): string => {
  if (!t) return fallback;
  const translated = t(key);
  return translated === key ? fallback : translated;
};

interface TravelPassHeaderProps extends HeaderProps {
  variant?: 'transparent' | 'solid';
}

export const Header = React.memo(function Header({
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
  variant = 'solid',
}: TravelPassHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll for header style changes
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setSearchQuery('');
    }
  };

  // Determine if we should use transparent style
  const useTransparent = variant === 'transparent' && !isScrolled;

  const headerBg = useTransparent
    ? 'bg-gradient-to-b from-black/50 to-transparent'
    : 'bg-white shadow-sm';

  const textColor = useTransparent ? 'text-white' : 'text-gray-700';
  const textHoverColor = useTransparent ? 'hover:text-blue-200' : 'hover:text-blue-600';
  const logoColor = useTransparent ? 'text-white' : 'text-blue-600';

  return (
    <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${headerBg}`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center">
            <button onClick={onNavigateToHome} className="flex items-center">
              <i className={`fas fa-globe-americas text-2xl mr-2 ${logoColor}`}></i>
              <span className={`font-bold text-xl ${logoColor}`}>TravelPass</span>
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <button
              onClick={() => onNavigate?.('/products')}
              className={`${textColor} ${textHoverColor} font-medium transition`}
            >
              {getText(t, 'travelpass.nav.destinations', 'Destinations')}
            </button>
            <button
              onClick={() => onNavigate?.('/products')}
              className={`${textColor} ${textHoverColor} font-medium transition`}
            >
              {getText(t, 'travelpass.nav.packages', 'eSIM Packages')}
            </button>
            <button
              onClick={() => onNavigate?.('/help')}
              className={`${textColor} ${textHoverColor} font-medium transition`}
            >
              {getText(t, 'travelpass.nav.support', 'Support')}
            </button>
            <button
              onClick={() => onNavigate?.('/contact')}
              className={`${textColor} ${textHoverColor} font-medium transition`}
            >
              {getText(t, 'travelpass.nav.about', 'About Us')}
            </button>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* My Orders */}
            <button
              onClick={() => onNavigate?.('/orders')}
              className={`${textColor} ${textHoverColor} hidden sm:flex items-center transition`}
            >
              <i className="fas fa-suitcase-rolling"></i>
              <span className="ml-1 hidden lg:inline">{getText(t, 'travelpass.nav.myTrips', 'My Trips')}</span>
            </button>

            {/* Account */}
            {isAuthenticated ? (
              <button
                onClick={onNavigateToProfile}
                className={`${textColor} ${textHoverColor} hidden sm:flex items-center transition`}
              >
                <i className="fas fa-user-circle"></i>
                <span className="ml-1 hidden lg:inline">{user?.firstName || getText(t, 'travelpass.nav.account', 'Account')}</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.('/profile')}
                className={`${textColor} ${textHoverColor} hidden sm:flex items-center transition`}
              >
                <i className="fas fa-user-circle"></i>
                <span className="ml-1 hidden lg:inline">{getText(t, 'travelpass.nav.account', 'Account')}</span>
              </button>
            )}

            {/* Sign In / Sign Out Button */}
            {isAuthenticated ? (
              <button
                onClick={onLogout}
                className={`${textColor} ${textHoverColor} text-sm font-medium transition hidden sm:block`}
              >
                {getText(t, 'travelpass.nav.logout', 'Logout')}
              </button>
            ) : (
              <button
                onClick={onNavigateToLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 ease-in-out"
              >
                {getText(t, 'travelpass.nav.signIn', 'Sign In')}
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`md:hidden ${textColor}`}
            >
              <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white rounded-lg shadow-lg p-4 mt-2 mb-4">
            <button
              onClick={() => { onNavigate?.('/products'); setIsMenuOpen(false); }}
              className="block text-gray-700 hover:text-blue-600 py-3 w-full text-left font-medium border-b border-gray-100"
            >
              <i className="fas fa-globe-americas w-6 text-blue-600"></i>
              {getText(t, 'travelpass.nav.destinations', 'Destinations')}
            </button>
            <button
              onClick={() => { onNavigate?.('/products'); setIsMenuOpen(false); }}
              className="block text-gray-700 hover:text-blue-600 py-3 w-full text-left font-medium border-b border-gray-100"
            >
              <i className="fas fa-sim-card w-6 text-blue-600"></i>
              {getText(t, 'travelpass.nav.packages', 'eSIM Packages')}
            </button>
            <button
              onClick={() => { onNavigate?.('/help'); setIsMenuOpen(false); }}
              className="block text-gray-700 hover:text-blue-600 py-3 w-full text-left font-medium border-b border-gray-100"
            >
              <i className="fas fa-headset w-6 text-blue-600"></i>
              {getText(t, 'travelpass.nav.support', 'Support')}
            </button>
            <button
              onClick={() => { onNavigate?.('/contact'); setIsMenuOpen(false); }}
              className="block text-gray-700 hover:text-blue-600 py-3 w-full text-left font-medium border-b border-gray-100"
            >
              <i className="fas fa-info-circle w-6 text-blue-600"></i>
              {getText(t, 'travelpass.nav.about', 'About Us')}
            </button>
            <button
              onClick={() => { onNavigate?.('/orders'); setIsMenuOpen(false); }}
              className="block text-gray-700 hover:text-blue-600 py-3 w-full text-left font-medium border-b border-gray-100"
            >
              <i className="fas fa-suitcase-rolling w-6 text-blue-600"></i>
              {getText(t, 'travelpass.nav.myTrips', 'My Trips')}
            </button>
            <button
              onClick={() => { onNavigate?.('/profile'); setIsMenuOpen(false); }}
              className="block text-gray-700 hover:text-blue-600 py-3 w-full text-left font-medium"
            >
              <i className="fas fa-user-circle w-6 text-blue-600"></i>
              {getText(t, 'travelpass.nav.account', 'Account')}
            </button>

            {/* Mobile Auth Buttons */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              {isAuthenticated ? (
                <button
                  onClick={() => { onLogout(); setIsMenuOpen(false); }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition"
                >
                  {getText(t, 'travelpass.nav.logout', 'Logout')}
                </button>
              ) : (
                <button
                  onClick={() => { onNavigateToLogin(); setIsMenuOpen(false); }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition"
                >
                  {getText(t, 'travelpass.nav.signIn', 'Sign In')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
});

export default Header;

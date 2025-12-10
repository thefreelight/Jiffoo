/**
 * Header Component - Jiffoo Blue Minimal Design
 *
 * Main navigation header with search, cart, and user menu.
 * Supports i18n through the t() translation function prop.
 * Uses Jiffoo Blue Minimal design system.
 */

import React from 'react';
import { Search, ShoppingCart, User, Menu, Heart, X } from 'lucide-react';
import { Button, cn } from '@jiffoo/ui';
import type { HeaderProps } from '../../../../shared/src/types/theme';

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
  const [isScrolled, setIsScrolled] = React.useState(false);

  // Track scroll for header shadow
  React.useEffect(() => {
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

  return (
    <header
      className="jf-header"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: isScrolled ? 'rgba(255, 255, 255, 0.98)' : 'rgba(248, 250, 252, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: isScrolled ? '1px solid #E2E8F0' : '1px solid transparent',
        boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : 'none',
        transition: 'all 0.2s ease'
      }}
    >
      <div className="jf-container" style={{ maxWidth: '1024px', margin: '0 auto', padding: '0 24px' }}>
        <div className="jf-header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '72px', gap: '1rem' }}>
          {/* Logo - Jiffoo Blue */}
          <button
            onClick={onNavigateToHome}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.2s ease'
            }}
          >
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#3B82F6',
              letterSpacing: '-0.03em'
            }}>Jiffoo</span>
          </button>

          {/* Navigation - Desktop - Jiffoo Blue */}
          <nav className="jf-nav jf-desktop-nav hidden lg:flex" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            {[
              { label: getText('shop.nav.products', 'Products'), onClick: onNavigateToProducts },
              { label: getText('shop.nav.categories', 'Categories'), onClick: onNavigateToCategories },
              { label: getText('shop.nav.deals', 'Deals'), onClick: onNavigateToDeals },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#3B82F6'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#64748B'}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Actions - Jiffoo Blue */}
          <div className="jf-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Cart */}
            <button
              onClick={onNavigateToCart}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              aria-label="Cart"
            >
              <ShoppingCart style={{ width: '20px', height: '20px' }} />
              {cartItemCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 5px',
                  borderRadius: '9999px',
                  background: '#3B82F6',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>

            {/* User Menu - Jiffoo Blue */}
            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={onNavigateToProfile}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title={getText('shop.header.profile', 'Profile')}
                >
                  <User style={{ width: '20px', height: '20px' }} />
                </button>
                <button
                  onClick={onLogout}
                  className="hidden sm:flex"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                >
                  {getText('shop.header.logout', 'Logout')}
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={onNavigateToLogin}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                >
                  {getText('shop.header.login', 'Login')}
                </button>
                <button
                  onClick={onNavigateToRegister}
                  style={{
                    background: '#3B82F6',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px -4px rgba(59, 130, 246, 0.5)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {getText('shop.header.signUp', 'Sign Up')}
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'lg:hidden flex items-center justify-center w-10 h-10 rounded-xl',
                'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100',
                'transition-colors duration-150'
              )}
              aria-label="Menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-4">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="search"
              placeholder={getText('shop.nav.searchPlaceholder', 'Search products...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 bg-neutral-100 border-0 rounded-xl',
                'text-sm text-neutral-900 placeholder:text-neutral-400',
                'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white',
                'transition-all duration-200'
              )}
            />
          </form>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-neutral-200 py-4 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-1">
              {[
                { label: getText('shop.nav.products', 'Products'), onClick: onNavigateToProducts },
                { label: getText('shop.nav.categories', 'Categories'), onClick: onNavigateToCategories },
                { label: getText('shop.nav.deals', 'Deals'), onClick: onNavigateToDeals },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    item.onClick();
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    'px-4 py-3 text-base font-medium text-neutral-700 rounded-xl text-left',
                    'hover:bg-neutral-100 active:bg-neutral-200',
                    'transition-colors duration-150'
                  )}
                >
                  {item.label}
                </button>
              ))}

              <div className="flex flex-col space-y-2 pt-4 mt-4 border-t border-neutral-200">
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
}


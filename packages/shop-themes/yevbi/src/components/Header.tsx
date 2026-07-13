/**
 * Yevbi Header Component
 * Consumer eSIM store navigation — minimal dark style
 */

import type { HeaderProps } from '../types';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  User,
  LogOut,
  ShoppingCart,
  Search,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ThemeToggle } from './ThemeToggle';

interface YevbiHeaderProps extends HeaderProps {
  variant?: 'transparent' | 'solid';
}

export function Header({
  isAuthenticated,
  cartItemCount,
  onNavigate,
  onLogout,
  onNavigateToProfile,
  onNavigateToLogin,
  onNavigateToCart,
  onNavigateToHome,
  variant = 'solid',
}: YevbiHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const useTransparent = variant === 'transparent' && !isScrolled;

  const isActive = (path: string) => pathname?.includes(path) ?? false;

  const headerStyles = cn(
    'fixed top-0 left-0 w-full z-50 transition-all duration-300 border-b',
    useTransparent
      ? 'bg-transparent border-transparent py-6'
      : 'bg-background/95 backdrop-blur-md border-border py-4'
  );

  const navLinkStyles = (path: string) => cn(
    'text-xs font-mono uppercase tracking-widest transition-colors duration-200',
    isActive(path)
      ? 'text-foreground'
      : 'text-muted-foreground hover:text-foreground'
  );

  const iconBtnStyles = cn(
    'relative p-2 transition-all border border-transparent hover:border-border hover:bg-accent',
    'text-muted-foreground hover:text-foreground'
  );

  const isProductsActive = isActive('/products');

  return (
    <header className={headerStyles}>
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between gap-6">

          {/* Logo */}
          <button
            onClick={onNavigateToHome}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <span className={cn(
              'font-mono font-bold text-xl uppercase tracking-tighter transition-colors',
              useTransparent ? 'text-muted-foreground' : 'text-foreground'
            )}>
              YEVBI
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <button
              onClick={() => onNavigate?.('/products')}
              className={cn(
                'font-mono text-xs uppercase px-5 py-2 border transition-all flex items-center gap-1.5',
                isProductsActive
                  ? 'bg-transparent text-foreground border-foreground'
                  : 'bg-foreground text-background border-foreground hover:bg-transparent hover:text-foreground'
              )}
            >
              Get eSIM
            </button>
            <button onClick={() => onNavigate?.('/how-it-works')} className={navLinkStyles('/how-it-works')}>How It Works</button>
            <button onClick={() => onNavigate?.('/help')} className={navLinkStyles('/help')}>Help Center</button>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <div className="mr-2 hidden sm:block">
              <ThemeToggle />
            </div>

            {/* Search */}
            <button
              onClick={() => onNavigate?.('/search')}
              className={iconBtnStyles}
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Cart */}
            <button
              onClick={onNavigateToCart}
              className={cn(iconBtnStyles, 'mr-2')}
              title="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-foreground text-background text-[9px] font-bold flex items-center justify-center font-mono px-0.5">
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </span>
              )}
            </button>

            {/* Sign In / Sign Out — desktop */}
            <div className="hidden sm:flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={onNavigateToProfile}
                    className={iconBtnStyles}
                    title="My Account"
                  >
                    <User className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onLogout}
                    className={cn(
                      'font-mono text-xs uppercase px-4 py-2 border transition-all',
                      'text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                    )}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={onNavigateToLogin}
                  className={cn(
                    'font-mono text-xs uppercase px-4 py-2 border transition-all',
                    'text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                  )}
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'p-2 border transition-all lg:hidden ml-1',
                useTransparent
                  ? 'border-border text-muted-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              )}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        <div className={cn(
          'lg:hidden absolute top-full left-0 w-full bg-background border-b border-border transition-all duration-300 origin-top overflow-hidden',
          isMenuOpen ? 'scale-y-100 opacity-100 py-5' : 'scale-y-0 opacity-0 h-0'
        )}>
          <div className="container mx-auto px-4 flex flex-col gap-1.5">
            <div className="mb-4 pb-4 border-b border-border flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Appearance</span>
              <ThemeToggle />
            </div>
            <MobileNavLink label="How It Works" active={isActive('/how-it-works')} onClick={() => { onNavigate?.('/how-it-works'); setIsMenuOpen(false); }} />
            <MobileNavLink label="Help Center" active={isActive('/help')} onClick={() => { onNavigate?.('/help'); setIsMenuOpen(false); }} />
            {isAuthenticated && (
              <MobileNavLink label="My Orders" active={isActive('/orders')} onClick={() => { onNavigate?.('/orders'); setIsMenuOpen(false); }} />
            )}

            <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => { onNavigateToProfile(); setIsMenuOpen(false); }}
                    className="w-full font-mono text-xs uppercase flex items-center justify-center gap-2 px-4 py-3 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all"
                  >
                    <User className="w-4 h-4" /> My Account
                  </button>
                  <button
                    onClick={() => { onLogout(); setIsMenuOpen(false); }}
                    className="w-full font-mono text-xs uppercase flex items-center justify-center gap-2 px-4 py-3 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { onNavigateToLogin(); setIsMenuOpen(false); }}
                    className="w-full font-mono text-xs uppercase flex items-center justify-center gap-2 px-4 py-3 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { onNavigate?.('/products'); setIsMenuOpen(false); }}
                    className={cn(
                      'w-full font-mono text-xs uppercase flex items-center justify-center gap-2 px-4 py-3 border transition-all',
                      isProductsActive
                        ? 'border-foreground text-foreground bg-transparent'
                        : 'border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground'
                    )}
                  >
                    Get eSIM
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileNavLink({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-between w-full px-4 py-3 border transition-all group',
        active
          ? 'border-border bg-muted text-foreground'
          : 'border-transparent hover:border-border bg-muted text-muted-foreground hover:text-foreground'
      )}
    >
      <span className="font-mono uppercase text-xs tracking-widest">{label}</span>
      <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

export default Header;

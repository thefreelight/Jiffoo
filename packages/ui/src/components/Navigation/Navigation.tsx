'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { prefersReducedMotion } from '../../utils/a11y';

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface NavigationProps {
  logo: React.ReactNode;
  items: NavItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function Navigation({ logo, items, actions, className }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 h-16 bg-white/90 backdrop-blur-md transition-all duration-normal',
        scrolled && 'border-b border-slate-100 shadow-sm',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0">{logo}</div>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-8 text-sm font-medium">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'transition-colors duration-fast',
                item.active
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-blue-600'
              )}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">{actions}</div>

        {/* Mobile Menu Button */}
        <button
          className={cn(
            'md:hidden p-2 -mr-2 rounded-lg',
            'text-slate-600 hover:bg-slate-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
          )}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
          >
            <div className="py-4 px-4 sm:px-6 space-y-1">
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block py-2.5 px-3 rounded-lg text-base transition-colors',
                    item.active
                      ? 'text-blue-600 font-semibold bg-blue-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              {actions && (
                <div className="mt-4 pt-4 border-t border-slate-100">{actions}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

Navigation.displayName = 'Navigation';


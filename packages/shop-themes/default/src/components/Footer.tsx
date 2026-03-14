/**
 * Footer Component - Jiffoo Blue Minimal Design
 *
 * Site footer with quick links, customer service, and contact info.
 * Supports i18n through the t() translation function prop.
 * Uses Jiffoo Blue Minimal design system with dark mode support.
 */

import React from 'react';
import { cn } from '@jiffoo/ui';
import type { FooterProps } from '../../../../shared/src/types/theme';

export const Footer = React.memo(function Footer({
  config,
  t,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
  onNavigateToHelp,
  onNavigateToContact,
  onNavigateToPrivacy,
  onNavigateToTerms,
}: FooterProps) {
  // Helper function to get translated text with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const brandName = config?.brand?.name || 'Jiffoo';
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 sm:py-16 lg:py-20 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
              {brandName}
            </span>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
              {getText('shop.footer.companyDescription', 'Your trusted e-commerce store for quality products.')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {getText('shop.footer.quickLinks', 'Quick Links')}
            </h4>
            <div className="flex flex-col space-y-2">
              <button
                onClick={onNavigateToProducts}
                className={cn(
                  'text-sm text-gray-600 dark:text-gray-400 text-left transition-colors',
                  'hover:text-blue-600 dark:hover:text-blue-400'
                )}
              >
                {getText('shop.footer.allProducts', 'Products')}
              </button>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {getText('shop.footer.customerService', 'Support')}
            </h4>
            <div className="flex flex-col space-y-2">
              <button
                onClick={onNavigateToHelp}
                className={cn(
                  'text-sm text-gray-600 dark:text-gray-400 text-left transition-colors',
                  'hover:text-blue-600 dark:hover:text-blue-400'
                )}
              >
                {getText('shop.footer.helpCenter', 'Help')}
              </button>
              <button
                onClick={onNavigateToContact}
                className={cn(
                  'text-sm text-gray-600 dark:text-gray-400 text-left transition-colors',
                  'hover:text-blue-600 dark:hover:text-blue-400'
                )}
              >
                {getText('shop.footer.contactUs', 'Contact')}
              </button>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {getText('shop.footer.legal', 'Legal')}
            </h4>
            <div className="flex flex-col space-y-2">
              <button
                onClick={onNavigateToPrivacy}
                className={cn(
                  'text-sm text-gray-600 dark:text-gray-400 text-left transition-colors',
                  'hover:text-blue-600 dark:hover:text-blue-400'
                )}
              >
                {getText('shop.footer.privacyPolicy', 'Privacy')}
              </button>
              <button
                onClick={onNavigateToTerms}
                className={cn(
                  'text-sm text-gray-600 dark:text-gray-400 text-left transition-colors',
                  'hover:text-blue-600 dark:hover:text-blue-400'
                )}
              >
                {getText('shop.footer.termsOfService', 'Terms')}
              </button>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200 dark:border-slate-800 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t
              ? t('shop.footer.copyright', { year: String(currentYear), brand: brandName })
              : `© ${currentYear} ${brandName}. All rights reserved.`
            }
          </p>
        </div>
      </div>
    </footer>
  );
});

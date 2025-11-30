/**
 * Footer Component
 *
 * Site footer with quick links, customer service, and contact info.
 * Supports i18n through the t() translation function prop.
 */

import React from 'react';
import Link from 'next/link';
import { Facebook, Twitter, Instagram, Github, Mail, Phone, MapPin } from 'lucide-react';
import type { FooterProps } from '../../../../shared/src/types/theme';

export function Footer({
  config,
  t,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
  onNavigateToNewArrivals,
  onNavigateToBestsellers,
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
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{brandName.charAt(0)}</span>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white">{brandName}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getText('shop.footer.companyDescription', 'Your trusted online marketplace for quality products and exceptional service.')}
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">{getText('shop.footer.quickLinks', 'Quick Links')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={onNavigateToProducts}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {getText('shop.footer.allProducts', 'All Products')}
                </button>
              </li>
              <li>
                <button
                  onClick={onNavigateToCategories}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {getText('shop.nav.categories', 'Categories')}
                </button>
              </li>
              <li>
                <button
                  onClick={onNavigateToDeals}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {getText('shop.footer.specialDeals', 'Special Deals')}
                </button>
              </li>
              <li>
                <button
                  onClick={onNavigateToNewArrivals}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {getText('shop.nav.newArrivals', 'New Arrivals')}
                </button>
              </li>
              <li>
                <button
                  onClick={onNavigateToBestsellers}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {getText('shop.nav.bestsellers', 'Best Sellers')}
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">{getText('shop.footer.customerService', 'Customer Service')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={onNavigateToHelp}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {getText('shop.footer.helpCenter', 'Help Center')}
                </button>
              </li>
              <li>
                <button
                  onClick={onNavigateToContact}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {getText('shop.footer.contactUs', 'Contact Us')}
                </button>
              </li>
              <li>
                <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  {getText('shop.footer.shippingInfo', 'Shipping Info')}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  {getText('shop.footer.returnsExchanges', 'Returns & Exchanges')}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  {getText('shop.footer.faq', 'FAQ')}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">{getText('shop.footer.contactInfo', 'Contact Info')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">support@jiffoo.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">
                  123 Commerce St, Tech City, TC 12345
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t
              ? t('shop.footer.copyright', { year: String(currentYear), brand: brandName })
              : `© ${currentYear} ${brandName}. All rights reserved.`
            }
          </div>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <button
              onClick={onNavigateToPrivacy}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {getText('shop.footer.privacyPolicy', 'Privacy Policy')}
            </button>
            <button
              onClick={onNavigateToTerms}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {getText('shop.footer.termsOfService', 'Terms of Service')}
            </button>
            <a href="#" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              {getText('shop.footer.cookiePolicy', 'Cookie Policy')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}


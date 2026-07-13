/**
 * TravelPass Footer Component
 *
 * SDK-compliant component accepting FooterProps from theme.ts
 * Styled to match eSIM Mall prototype with Font Awesome icons
 */

import React from 'react';
import type { FooterProps } from '../types';
import { useState } from 'react';

// Helper for translations with fallback
const getText = (t: FooterProps['t'], key: string, fallback: string): string => {
  if (!t) return fallback;
  const translated = t(key);
  return translated === key ? fallback : translated;
};

export const Footer = React.memo(function Footer({
  config,
  onNavigate,
  onNavigateToProducts,
  onNavigateToCategories,
  onNavigateToDeals,
  onNavigateToNewArrivals,
  onNavigateToBestsellers,
  onNavigateToHelp,
  onNavigateToContact,
  onNavigateToPrivacy,
  onNavigateToTerms,
  t,
}: FooterProps) {
  const [email, setEmail] = useState('');
  const brandName = config?.brand?.name?.trim() || 'TravelPass';

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    setEmail('');
  };

  return (
    <footer className="bg-gray-800 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{brandName}</h3>
            <p className="text-gray-400 mb-4">
              {getText(
                t,
                'travelpass.footer.description',
                `${brandName} helps travelers stay connected with reliable eSIM packages worldwide.`,
              )}
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                <i className="fab fa-twitter"></i>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                <i className="fab fa-instagram"></i>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                <i className="fab fa-linkedin-in"></i>
              </a>
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{getText(t, 'travelpass.footer.company', 'Company')}</h3>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigate?.('/about')} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.aboutUs', 'About Us')}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('/careers')} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.careers', 'Careers')}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('/blog')} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.blog', 'Blog')}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('/press')} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.press', 'Press')}
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{getText(t, 'travelpass.footer.resources', 'Resources')}</h3>
            <ul className="space-y-2">
              <li>
                <button onClick={onNavigateToHelp} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.helpCenter', 'Help Center')}
                </button>
              </li>
              <li>
                <button onClick={onNavigateToContact} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.contactUs', 'Contact Us')}
                </button>
              </li>
              <li>
                <button onClick={onNavigateToPrivacy} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.privacy', 'Privacy Policy')}
                </button>
              </li>
              <li>
                <button onClick={onNavigateToTerms} className="text-gray-400 hover:text-white transition">
                  {getText(t, 'travelpass.footer.terms', 'Terms of Service')}
                </button>
              </li>
            </ul>
          </div>

          {/* Subscribe */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{getText(t, 'travelpass.footer.subscribe', 'Subscribe')}</h3>
            <p className="text-gray-400 mb-4">
              {getText(t, 'travelpass.footer.subscribeText', 'Get the latest news and offers')}
            </p>
            <form onSubmit={handleSubscribe}>
              <div className="flex">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={getText(t, 'travelpass.footer.emailPlaceholder', 'Your email')}
                  className="px-4 py-2 rounded-l-md w-full focus:outline-none text-gray-800"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-r-md transition"
                >
                  <i className="fas fa-paper-plane"></i>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} {brandName}. {getText(t, 'travelpass.footer.rights', 'All rights reserved.')}
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            {/* Payment Icons */}
            <i className="fab fa-cc-visa text-2xl text-gray-400"></i>
            <i className="fab fa-cc-mastercard text-2xl text-gray-400"></i>
            <i className="fab fa-cc-paypal text-2xl text-gray-400"></i>
            <i className="fab fa-cc-apple-pay text-2xl text-gray-400"></i>
          </div>
        </div>
      </div>
    </footer>
  );
});

export default Footer;

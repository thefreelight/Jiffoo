/**
 * TravelPass Footer Component
 * 
 * SDK-compliant component accepting FooterProps from theme.ts
 */

import type { FooterProps } from '../../../../../shared/src/types/theme';

// Helper for translations with fallback
const getText = (t: FooterProps['t'], key: string, fallback: string): string => {
  if (!t) return fallback;
  const translated = t(key);
  return translated === key ? fallback : translated;
};

export function Footer({
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
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-2">🌐</span>
              <span className="font-bold text-xl">TravelPass</span>
            </div>
            <p className="text-gray-400 text-sm">
              {getText(t, 'shop.footer.description', 'Stay connected anywhere in the world with our affordable eSIM travel packages.')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">{getText(t, 'shop.footer.quickLinks', 'Quick Links')}</h4>
            <ul className="space-y-2 text-gray-400">
              <li><button onClick={onNavigateToProducts} className="hover:text-white transition">{getText(t, 'shop.footer.browsePackages', 'Browse Packages')}</button></li>
              <li><button onClick={onNavigateToDeals} className="hover:text-white transition">{getText(t, 'shop.footer.deals', 'Deals')}</button></li>
              <li><button onClick={onNavigateToNewArrivals} className="hover:text-white transition">{getText(t, 'shop.footer.newArrivals', 'New Arrivals')}</button></li>
              <li><button onClick={onNavigateToBestsellers} className="hover:text-white transition">{getText(t, 'shop.footer.bestsellers', 'Bestsellers')}</button></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">{getText(t, 'shop.footer.support', 'Support')}</h4>
            <ul className="space-y-2 text-gray-400">
              <li><button onClick={onNavigateToHelp} className="hover:text-white transition">{getText(t, 'shop.footer.helpCenter', 'Help Center')}</button></li>
              <li><button onClick={onNavigateToContact} className="hover:text-white transition">{getText(t, 'shop.footer.contactUs', 'Contact Us')}</button></li>
              <li><button onClick={onNavigateToTerms} className="hover:text-white transition">{getText(t, 'shop.footer.terms', 'Terms of Service')}</button></li>
              <li><button onClick={onNavigateToPrivacy} className="hover:text-white transition">{getText(t, 'shop.footer.privacy', 'Privacy Policy')}</button></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">{getText(t, 'shop.footer.contact', 'Contact Us')}</h4>
            <ul className="space-y-2 text-gray-400">
              <li className="flex items-center">
                <span className="mr-2">📧</span>
                support@travelpass.com
              </li>
              <li className="flex items-center">
                <span className="mr-2">📞</span>
                +1 (800) 123-4567
              </li>
            </ul>
            <div className="flex space-x-4 mt-4">
              <a href="#" className="text-gray-400 hover:text-white transition text-xl">𝕏</a>
              <a href="#" className="text-gray-400 hover:text-white transition text-xl">📷</a>
              <a href="#" className="text-gray-400 hover:text-white transition text-xl">📘</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>© 2024 TravelPass. {getText(t, 'shop.footer.rights', 'All rights reserved.')}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

/**
 * Footer Component - Jiffoo Blue Minimal Design
 *
 * Site footer with quick links, customer service, and contact info.
 * Supports i18n through the t() translation function prop.
 * Uses Jiffoo Blue Minimal design system.
 */

import React from 'react';
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
    <footer className="jf-footer" style={{ padding: '80px 0', background: 'white', borderTop: '1px solid #E2E8F0' }}>
      <div className="jf-container" style={{ maxWidth: '1024px', margin: '0 auto', padding: '0 24px' }}>
        <div className="jf-footer-content" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '3rem' }}>
          {/* Brand */}
          <div className="jf-footer-brand">
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3B82F6', letterSpacing: '-0.03em' }}>
              {brandName}
            </span>
            <p style={{ color: '#64748B', fontSize: '0.95rem', marginTop: '0.5rem', maxWidth: '250px' }}>
              {getText('shop.footer.companyDescription', 'Your trusted online marketplace for quality products.')}
            </p>
          </div>

          {/* Footer Links */}
          <div className="jf-footer-links" style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
            {/* Quick Links */}
            <div className="jf-footer-col">
              <h4 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                {getText('shop.footer.quickLinks', 'Quick Links')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: getText('shop.footer.allProducts', 'Products'), onClick: onNavigateToProducts },
                  { label: getText('shop.nav.categories', 'Categories'), onClick: onNavigateToCategories },
                  { label: getText('shop.footer.specialDeals', 'Deals'), onClick: onNavigateToDeals },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Support */}
            <div className="jf-footer-col">
              <h4 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                {getText('shop.footer.customerService', 'Support')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: getText('shop.footer.helpCenter', 'Help'), onClick: onNavigateToHelp },
                  { label: getText('shop.footer.contactUs', 'Contact'), onClick: onNavigateToContact },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div className="jf-footer-col">
              <h4 style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                {getText('shop.footer.legal', 'Legal')}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: getText('shop.footer.privacyPolicy', 'Privacy'), onClick: onNavigateToPrivacy },
                  { label: getText('shop.footer.termsOfService', 'Terms'), onClick: onNavigateToTerms },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #E2E8F0', textAlign: 'center' }}>
          <p style={{ color: '#64748B', fontSize: '0.9rem' }}>
            {t
              ? t('shop.footer.copyright', { year: String(currentYear), brand: brandName })
              : `© ${currentYear} ${brandName}. All rights reserved.`
            }
          </p>
        </div>
      </div>
    </footer>
  );
}


/**
 * Home Page Component - Jiffoo Blue Minimal Design
 *
 * Displays the main landing page with hero section, features, and CTA.
 * Supports i18n through the t (translation) function prop.
 * Uses Jiffoo Blue Minimal design system for clean, modern styling.
 */

import React from 'react';
import { Button } from '@jiffoo/ui';
import { CheckCircle, Clock, Shield, ArrowRight, Zap, Package, Headphones } from 'lucide-react';
import type { HomePageProps } from '../../../../shared/src/types/theme';

export function HomePage({ config, onNavigate, t }: HomePageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Hero Section - Jiffoo Blue Minimal */}
      <section className="jf-hero" style={{ paddingTop: 'calc(72px + 100px)', paddingBottom: '100px' }}>
        <div className="jf-container">
          <div className="jf-hero-content" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{
              fontSize: '3.75rem',
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: '1.5rem',
              color: '#0F172A',
              letterSpacing: '-0.01em'
            }}>
              {getText('shop.home.hero.title', 'Welcome to')} <span style={{ color: '#3B82F6' }}>Jiffoo</span> {getText('shop.home.hero.titleSuffix', 'Store')}
            </h1>
            <p style={{
              fontSize: '1.25rem',
              color: '#64748B',
              marginBottom: '3rem',
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              {getText('shop.home.hero.subtitle', 'Discover quality products with a modern shopping experience. Fast, secure, and beautifully designed.')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '5rem' }}>
              <button
                onClick={() => onNavigate?.('/products')}
                className="jf-btn jf-btn-primary"
                style={{
                  background: '#3B82F6',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px -4px rgba(59, 130, 246, 0.5)',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {getText('shop.home.hero.startShopping', 'Start Shopping')}
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigate?.('/categories')}
                className="jf-btn jf-btn-secondary"
                style={{
                  background: 'white',
                  color: '#64748B',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {getText('shop.home.hero.browseCategories', 'Browse Categories')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Clean cards with blue accents */}
      <section style={{ padding: '100px 0', background: 'white', borderTop: '1px solid #E2E8F0' }}>
        <div className="jf-container">
          <div style={{ marginBottom: '5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>
              {getText('shop.home.whyChooseUs.title', 'Why Choose Us')}
            </h2>
            <p style={{ color: '#64748B', fontSize: '1.1rem' }}>
              {getText('shop.home.whyChooseUs.subtitle', 'We are committed to providing the best shopping experience')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4rem' }} className="jf-features-grid">
            {/* Quality Products */}
            <div className="jf-feature-card" style={{ textAlign: 'center', padding: '2rem', borderRadius: '12px', transition: 'all 0.3s ease' }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: '#EFF6FF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto'
              }}>
                <CheckCircle style={{ width: '28px', height: '28px', color: '#3B82F6' }} />
              </div>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
                {getText('shop.home.whyChooseUs.qualityProducts.title', 'Quality Products')}
              </h3>
              <p style={{ color: '#64748B', fontSize: '1rem', lineHeight: 1.6 }}>
                {getText('shop.home.whyChooseUs.qualityProducts.description', 'Carefully selected products with guaranteed quality')}
              </p>
            </div>

            {/* Fast Delivery */}
            <div className="jf-feature-card" style={{ textAlign: 'center', padding: '2rem', borderRadius: '12px', transition: 'all 0.3s ease' }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: '#EFF6FF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto'
              }}>
                <Zap style={{ width: '28px', height: '28px', color: '#3B82F6' }} />
              </div>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
                {getText('shop.home.whyChooseUs.fastDelivery.title', 'Fast Delivery')}
              </h3>
              <p style={{ color: '#64748B', fontSize: '1rem', lineHeight: 1.6 }}>
                {getText('shop.home.whyChooseUs.fastDelivery.description', 'Quick and reliable shipping service')}
              </p>
            </div>

            {/* Secure Payment */}
            <div className="jf-feature-card" style={{ textAlign: 'center', padding: '2rem', borderRadius: '12px', transition: 'all 0.3s ease' }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: '#EFF6FF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto'
              }}>
                <Shield style={{ width: '28px', height: '28px', color: '#3B82F6' }} />
              </div>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
                {getText('shop.home.whyChooseUs.securePayment.title', 'Secure Payment')}
              </h3>
              <p style={{ color: '#64748B', fontSize: '1rem', lineHeight: 1.6 }}>
                {getText('shop.home.whyChooseUs.securePayment.description', 'Multiple payment options, safe and secure')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Clean minimal */}
      <section style={{ padding: '100px 0', background: '#F8FAFC' }}>
        <div className="jf-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>
            {getText('shop.home.cta.title', 'Ready to Start Shopping?')}
          </h2>
          <p style={{ color: '#64748B', marginBottom: '2.5rem', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', fontSize: '1.1rem' }}>
            {getText('shop.home.cta.description', 'Browse our product catalog and find what you love')}
          </p>
          <button
            onClick={() => onNavigate?.('/products')}
            style={{
              background: '#3B82F6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px -4px rgba(59, 130, 246, 0.5)',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {getText('shop.home.cta.viewAllProducts', 'View All Products')}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}

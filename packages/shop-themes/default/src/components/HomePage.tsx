/**
 * Home Page Component
 *
 * Displays the main landing page with hero section, features, and CTA.
 * Supports i18n through the t (translation) function prop.
 */

import React from 'react';
import type { HomePageProps } from '../../../../shared/src/types/theme';

export function HomePage({ config, onNavigate, t }: HomePageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">
              {getText('shop.home.hero.title', 'Welcome to Our Store')}
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              {getText('shop.home.hero.subtitle', 'Discover quality products and enjoy shopping')}
            </p>
            <button
              onClick={() => onNavigate?.('/products')}
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              {getText('shop.home.hero.startShopping', 'Start Shopping')}
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {getText('shop.home.whyChooseUs.title', 'Why Choose Us')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getText('shop.home.whyChooseUs.qualityProducts.title', 'Quality Products')}
              </h3>
              <p className="text-gray-600">
                {getText('shop.home.whyChooseUs.qualityProducts.description', 'Carefully selected products with guaranteed quality')}
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getText('shop.home.whyChooseUs.fastDelivery.title', 'Fast Delivery')}
              </h3>
              <p className="text-gray-600">
                {getText('shop.home.whyChooseUs.fastDelivery.description', 'Quick and reliable shipping service')}
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getText('shop.home.whyChooseUs.securePayment.title', 'Secure Payment')}
              </h3>
              <p className="text-gray-600">
                {getText('shop.home.whyChooseUs.securePayment.description', 'Multiple payment options, safe and secure')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            {getText('shop.home.cta.title', 'Ready to Start Shopping?')}
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            {getText('shop.home.cta.description', 'Browse our product catalog and find what you love')}
          </p>
          <button
            onClick={() => onNavigate?.('/products')}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            {getText('shop.home.cta.viewAllProducts', 'View All Products')}
          </button>
        </div>
      </section>
    </div>
  );
}

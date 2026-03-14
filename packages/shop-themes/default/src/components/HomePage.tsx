/**
 * Home Page Component - Admin Style Design
 *
 * Minimalist homepage matching the shop's design system.
 * Uses #fcfdfe background and blue accent colors.
 */

import React from 'react';
import { ArrowRight, Package, Truck, Shield, Star } from 'lucide-react';
import type { HomePageProps } from '../../../../shared/src/types/theme';

export const HomePage = React.memo(function HomePage({ config, onNavigate, t }: HomePageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full">
              <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                {getText('shop.home.hero.badge', 'WELCOME TO JIFFOO')}
              </span>
            </div>
            
            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 dark:text-white tracking-tight leading-[1.1]">
              {getText('shop.home.hero.title', 'Quality Products,')}
              <br />
              {getText('shop.home.hero.titleLine2', 'Delivered Fast')}
            </h1>
            
            {/* Subtitle */}
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest max-w-2xl mx-auto">
              {getText('shop.home.hero.subtitle', 'DISCOVER OUR CAREFULLY CURATED SELECTION')}
            </p>
            
            {/* CTA */}
            <div className="pt-4">
              <button
                onClick={() => onNavigate?.('/products')}
                className="inline-flex items-center gap-3 h-12 sm:h-14 px-6 sm:px-8 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-100 dark:shadow-blue-900/30 uppercase tracking-wider"
              >
                {getText('shop.home.hero.shopNow', 'SHOP NOW')}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 sm:py-16 px-4 bg-white dark:bg-slate-800 border-y border-gray-100 dark:border-slate-700">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">10K+</p>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">PRODUCTS</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">50K+</p>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">CUSTOMERS</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">4.8</p>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">RATING</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">24/7</p>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">SUPPORT</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="max-w-3xl mb-12 sm:mb-16 text-center mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-4 w-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {getText('shop.home.features.badge', 'WHY SHOP WITH US')}
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              {getText('shop.home.features.title', 'Built for Your Convenience')}
            </h2>
            <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mt-3">
              {getText('shop.home.features.subtitle', 'PREMIUM SHOPPING EXPERIENCE')}
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 dark:bg-blue-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                <Truck className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {getText('shop.home.features.shipping.badge', 'RAPID SHIPPING')}
                  </h4>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {getText('shop.home.features.shipping.title', 'Fast Delivery')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {getText('shop.home.features.shipping.description', 'Free shipping on orders over $50. Most orders arrive within 2-3 business days.')}
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 dark:bg-blue-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {getText('shop.home.features.secure.badge', 'PROTECTED TRANSACTIONS')}
                  </h4>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {getText('shop.home.features.secure.title', 'Secure Payment')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {getText('shop.home.features.secure.description', 'Your payment information is encrypted and secure. Shop with confidence.')}
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 dark:bg-blue-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                <Star className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {getText('shop.home.features.quality.badge', 'QUALITY ASSURED')}
                  </h4>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {getText('shop.home.features.quality.title', 'Premium Quality')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {getText('shop.home.features.quality.description', 'Every product is carefully selected and verified for authenticity and quality.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="space-y-6 sm:space-y-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-4 w-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {getText('shop.home.cta.badge', 'START YOUR JOURNEY')}
              </span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              {getText('shop.home.cta.title', 'Ready to Start Shopping?')}
            </h2>
            
            <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">
              {getText('shop.home.cta.subtitle', 'EXPLORE OUR COMPLETE CATALOG')}
            </p>
            
            <div className="pt-4">
              <button
                onClick={() => onNavigate?.('/products')}
                className="inline-flex items-center gap-3 h-12 sm:h-14 px-6 sm:px-8 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-100 dark:shadow-blue-900/30 uppercase tracking-wider"
              >
                {getText('shop.home.cta.viewProducts', 'VIEW ALL PRODUCTS')}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

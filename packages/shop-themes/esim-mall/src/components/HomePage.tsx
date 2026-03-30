/**
 * Home Page Component - TravelPass eSIM Design
 *
 * Full landing page for TravelPass eSIM travel connectivity service.
 * 7 sections: Hero, Search, Popular Destinations, How It Works,
 * Why Choose TravelPass, Testimonials, CTA Banner.
 * Uses Font Awesome icons and Tailwind utility classes.
 */

import React from 'react';
import type { HomePageProps } from '../types';

export const HomePage = React.memo(function HomePage({ config, onNavigate, t }: HomePageProps) {
  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated;
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ================================================================
          1. Hero Section - Full-width with background image & gradient
          ================================================================ */}
      <section className="relative mt-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 to-black/50 z-10" />
        <img
          src="https://images.unsplash.com/photo-1499678329028-101435549a4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80"
          alt="Travel destinations"
          className="w-full h-[600px] object-cover"
        />

        <div className="container mx-auto px-4 absolute inset-0 flex items-center z-20">
          <div className="max-w-xl text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {getText('travelpass.home.hero.title', 'Stay Connected Everywhere You Go')}
            </h1>
            <p className="text-xl mb-6">
              {getText(
                'travelpass.home.hero.subtitle',
                'Get affordable eSIM travel packages for 190+ countries. No contracts, instant activation.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => onNavigate?.('/products')}
                className="inline-block text-center py-3 px-6 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >
                {getText('travelpass.home.hero.browsePackages', 'Browse Packages')}
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-block text-center py-3 px-6 rounded-md bg-transparent border border-white text-white font-semibold hover:bg-white/20 transition"
              >
                {getText('travelpass.home.hero.howItWorks', 'How It Works')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          2. Search Section - Floating card overlapping hero
          ================================================================ */}
      <section className="bg-white py-8 shadow-md relative -mt-20 z-30 rounded-lg max-w-5xl mx-auto px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            {/* Destination */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getText('travelpass.home.search.destination', 'Destination')}
              </label>
              <div className="relative">
                <select className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 pl-10 pr-3">
                  <option value="">{getText('travelpass.home.search.selectCountry', 'Select country or region')}</option>
                  <option>United States</option>
                  <option>Europe</option>
                  <option>Japan</option>
                  <option>Thailand</option>
                  <option>Australia</option>
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-globe-americas text-gray-400" />
                </div>
              </div>
            </div>

            {/* Data Needed */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getText('travelpass.home.search.dataPlan', 'Data Needed')}
              </label>
              <div className="relative">
                <select className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 pl-10 pr-3">
                  <option value="">{getText('travelpass.home.search.selectData', 'Select data amount')}</option>
                  <option>1GB - Light Usage</option>
                  <option>3GB - Regular Usage</option>
                  <option>5GB - Heavy Usage</option>
                  <option>10GB - Intensive Usage</option>
                  <option>Unlimited</option>
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-wifi text-gray-400" />
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getText('travelpass.home.search.duration', 'Duration')}
              </label>
              <div className="relative">
                <select className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3 pl-10 pr-3">
                  <option value="">{getText('travelpass.home.search.selectDuration', 'Select duration')}</option>
                  <option>7 days</option>
                  <option>14 days</option>
                  <option>30 days</option>
                  <option>60 days</option>
                  <option>90 days</option>
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-calendar-alt text-gray-400" />
                </div>
              </div>
            </div>

            {/* Find Plans */}
            <div className="flex items-end">
              <button
                onClick={() => onNavigate?.('/products')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md transition"
              >
                <i className="fas fa-search mr-2" />
                {getText('travelpass.home.search.findPlans', 'Find Plans')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          3. Popular Destinations
          ================================================================ */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">
              {getText('travelpass.home.destinations.title', 'Popular Destinations')}
            </h2>
            <p className="text-gray-600 mt-2">
              {getText(
                'travelpass.home.destinations.subtitle',
                'Explore our most popular eSIM travel packages'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* France */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
              <div className="relative h-56">
                <img
                  src="https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80"
                  alt="France"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-white rounded-full py-1 px-3 shadow-md">
                  <span className="text-sm font-medium text-gray-800">
                    From $9.99
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-gray-800">France</h3>
                  <div className="flex items-center">
                    <i className="fas fa-star text-yellow-400" />
                    <span className="ml-1 text-gray-600">4.8</span>
                  </div>
                </div>
                <div className="flex items-center text-gray-600 mb-4">
                  <i className="fas fa-wifi mr-2" /> 4G/5G &bull; Multiple networks &bull; Europe
                </div>
                <button
                  onClick={() => onNavigate?.('/products')}
                  className="block text-center w-full py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition"
                >
                  {getText('travelpass.home.destinations.viewPlans', 'View Plans')}
                </button>
              </div>
            </div>

            {/* Japan */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
              <div className="relative h-56">
                <img
                  src="https://images.unsplash.com/photo-1480796927426-f609979314bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80"
                  alt="Japan"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-white rounded-full py-1 px-3 shadow-md">
                  <span className="text-sm font-medium text-gray-800">
                    From $12.99
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-gray-800">Japan</h3>
                  <div className="flex items-center">
                    <i className="fas fa-star text-yellow-400" />
                    <span className="ml-1 text-gray-600">4.9</span>
                  </div>
                </div>
                <div className="flex items-center text-gray-600 mb-4">
                  <i className="fas fa-wifi mr-2" /> 4G/5G &bull; NTT DoCoMo &bull; Asia
                </div>
                <button
                  onClick={() => onNavigate?.('/products')}
                  className="block text-center w-full py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition"
                >
                  {getText('travelpass.home.destinations.viewPlans', 'View Plans')}
                </button>
              </div>
            </div>

            {/* UAE */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
              <div className="relative h-56">
                <img
                  src="https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80"
                  alt="United Arab Emirates"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-white rounded-full py-1 px-3 shadow-md">
                  <span className="text-sm font-medium text-gray-800">
                    From $14.99
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-gray-800">UAE</h3>
                  <div className="flex items-center">
                    <i className="fas fa-star text-yellow-400" />
                    <span className="ml-1 text-gray-600">4.7</span>
                  </div>
                </div>
                <div className="flex items-center text-gray-600 mb-4">
                  <i className="fas fa-wifi mr-2" /> 4G/5G &bull; Etisalat &bull; Middle East
                </div>
                <button
                  onClick={() => onNavigate?.('/products')}
                  className="block text-center w-full py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition"
                >
                  {getText('travelpass.home.destinations.viewPlans', 'View Plans')}
                </button>
              </div>
            </div>

            {/* Thailand */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
              <div className="relative h-56">
                <img
                  src="https://images.unsplash.com/photo-1568797629192-578ec5f3f5f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80"
                  alt="Thailand"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-white rounded-full py-1 px-3 shadow-md">
                  <span className="text-sm font-medium text-gray-800">
                    From $8.99
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold text-gray-800">Thailand</h3>
                  <div className="flex items-center">
                    <i className="fas fa-star text-yellow-400" />
                    <span className="ml-1 text-gray-600">4.6</span>
                  </div>
                </div>
                <div className="flex items-center text-gray-600 mb-4">
                  <i className="fas fa-wifi mr-2" /> 4G/5G &bull; AIS &bull; Southeast Asia
                </div>
                <button
                  onClick={() => onNavigate?.('/products')}
                  className="block text-center w-full py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition"
                >
                  {getText('travelpass.home.destinations.viewPlans', 'View Plans')}
                </button>
              </div>
            </div>
          </div>

          {/* View All Destinations */}
          <div className="text-center mt-8">
            <button
              onClick={() => onNavigate?.('/products')}
              className="inline-block py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
            >
              {getText('travelpass.home.destinations.viewAll', 'View All Destinations')}
              <i className="fas fa-chevron-right ml-2" />
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================
          4. How It Works
          ================================================================ */}
      <section id="how-it-works" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">
              {getText('travelpass.home.howItWorks.title', 'How It Works')}
            </h2>
            <p className="text-gray-600 mt-2">
              {getText(
                'travelpass.home.howItWorks.subtitle',
                'Get connected in 3 simple steps'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-shopping-cart text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                {getText('travelpass.home.howItWorks.step1.title', '1. Purchase an eSIM')}
              </h3>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.howItWorks.step1.description',
                  'Choose from our wide range of travel packages based on your destination and data needs.'
                )}
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-qrcode text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                {getText('travelpass.home.howItWorks.step2.title', '2. Scan QR Code')}
              </h3>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.howItWorks.step2.description',
                  'Receive your eSIM QR code instantly via email and scan it with your smartphone.'
                )}
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-globe text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                {getText('travelpass.home.howItWorks.step3.title', '3. Connect and Go')}
              </h3>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.howItWorks.step3.description',
                  'Activate your eSIM when you\'re ready to travel and stay connected wherever you go.'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          5. Why Choose TravelPass
          ================================================================ */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">
              {getText('travelpass.home.whyChoose.title', 'Why Choose TravelPass')}
            </h2>
            <p className="text-gray-600 mt-2">
              {getText(
                'travelpass.home.whyChoose.subtitle',
                'We make staying connected while traveling simple and affordable'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Instant Activation */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-stopwatch text-3xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getText('travelpass.home.whyChoose.instant.title', 'Instant Activation')}
              </h3>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.whyChoose.instant.description',
                  'Get your eSIM instantly after purchase and activate it when you\'re ready to travel.'
                )}
              </p>
            </div>

            {/* No Hidden Fees */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-dollar-sign text-3xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getText('travelpass.home.whyChoose.noFees.title', 'No Hidden Fees')}
              </h3>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.whyChoose.noFees.description',
                  'Transparent pricing with no contracts or unexpected charges. Pay only for what you need.'
                )}
              </p>
            </div>

            {/* Global Coverage */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-globe-americas text-3xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getText('travelpass.home.whyChoose.global.title', 'Global Coverage')}
              </h3>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.whyChoose.global.description',
                  'Stay connected in 190+ countries worldwide with reliable local network coverage.'
                )}
              </p>
            </div>

            {/* 24/7 Support */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-blue-600 mb-4">
                <i className="fas fa-headset text-3xl" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {getText('travelpass.home.whyChoose.support.title', '24/7 Support')}
              </h3>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.whyChoose.support.description',
                  'Our customer support team is available around the clock to assist you with any issues.'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          6. Testimonials
          ================================================================ */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800">
              {getText('travelpass.home.testimonials.title', 'What Our Customers Say')}
            </h2>
            <p className="text-gray-600 mt-2">
              {getText(
                'travelpass.home.testimonials.subtitle',
                'Thousands of travelers trust TravelPass for their connectivity needs'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <img
                  src="https://randomuser.me/api/portraits/women/32.jpg"
                  alt="Sarah Johnson"
                  className="w-12 h-12 rounded-full object-cover mr-4"
                />
                <div>
                  <h4 className="font-semibold">Sarah Johnson</h4>
                  <div className="flex text-yellow-400">
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                  </div>
                </div>
              </div>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.testimonials.review1',
                  '"I used TravelPass for my trip to Europe and it worked flawlessly. The setup was incredibly easy and the connection was fast and reliable throughout my journey."'
                )}
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <img
                  src="https://randomuser.me/api/portraits/men/32.jpg"
                  alt="Michael Chen"
                  className="w-12 h-12 rounded-full object-cover mr-4"
                />
                <div>
                  <h4 className="font-semibold">Michael Chen</h4>
                  <div className="flex text-yellow-400">
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star-half-alt" />
                  </div>
                </div>
              </div>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.testimonials.review2',
                  '"As a frequent traveler, I\'ve tried many international SIM options. TravelPass eSIM is by far the most convenient. No more hunting for local SIMs at airports!"'
                )}
              </p>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <img
                  src="https://randomuser.me/api/portraits/women/68.jpg"
                  alt="Alicia Rodriguez"
                  className="w-12 h-12 rounded-full object-cover mr-4"
                />
                <div>
                  <h4 className="font-semibold">Alicia Rodriguez</h4>
                  <div className="flex text-yellow-400">
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                    <i className="fas fa-star" />
                  </div>
                </div>
              </div>
              <p className="text-gray-600">
                {getText(
                  'travelpass.home.testimonials.review3',
                  '"The customer service is outstanding! I had a small issue activating my eSIM and the support team helped me resolve it within minutes, even though it was 2 AM!"'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          7. CTA Banner
          ================================================================ */}
      <section className="py-16 bg-blue-600">
        <div className="container mx-auto text-center px-4">
          <h2 className="text-3xl font-bold text-white mb-6">
            {getText('travelpass.home.cta.title', 'Ready for Your Next Adventure?')}
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
            {getText(
              'travelpass.home.cta.subtitle',
              'Get connected with TravelPass eSIM and enjoy hassle-free internet access worldwide.'
            )}
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button
              onClick={() => onNavigate?.('/products')}
              className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-md hover:bg-gray-100 transition-colors"
            >
              {getText('travelpass.home.cta.findEsim', 'Find Your eSIM')}
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('how-it-works');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-3 border border-white text-white font-semibold rounded-md bg-transparent hover:bg-white/10 transition-colors"
            >
              {getText('travelpass.home.cta.learnMore', 'Learn More')}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
});

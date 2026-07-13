/**
 * Help Page — TravelPass Design
 * eSIM FAQ categories and common questions with FA icons.
 */

import React, { useState } from 'react';
import { cn } from '../lib/utils';
import type { HelpPageProps } from '../types';

const faqCategories = [
  {
    id: 'getting-started',
    icon: 'fas fa-rocket',
    color: 'bg-blue-50 text-blue-600',
    title: 'Getting Started',
    description: 'Learn how to purchase and activate your eSIM',
    faqs: [
      { q: 'What is an eSIM?', a: 'An eSIM (embedded SIM) is a digital SIM that allows you to activate a cellular plan without using a physical SIM card. It is built into your device and can be programmed with different carrier profiles.' },
      { q: 'How do I activate my eSIM?', a: 'After purchase, you will receive a QR code via email. Go to Settings > Cellular > Add eSIM on your device and scan the QR code. Your eSIM will be activated within minutes.' },
      { q: 'Which devices support eSIM?', a: 'Most modern smartphones support eSIM, including iPhone XS and newer, Samsung Galaxy S20 and newer, Google Pixel 3 and newer, and many more. Check your device specifications to confirm eSIM support.' },
    ],
  },
  {
    id: 'data-usage',
    icon: 'fas fa-wifi',
    color: 'bg-green-50 text-green-600',
    title: 'Data & Usage',
    description: 'Questions about data plans, speed, and coverage',
    faqs: [
      { q: 'How fast is the data connection?', a: 'Our eSIMs provide 4G/LTE and 5G speeds depending on your location and the local carrier network. Typical speeds range from 10-100 Mbps download.' },
      { q: 'Can I check my remaining data?', a: 'Yes! Log in to your TravelPass account and go to "My eSIMs" to see real-time data usage and remaining balance for each active eSIM.' },
      { q: 'What happens when my data runs out?', a: 'You can top up your data at any time through your account. If your data runs out, your connection will pause until you purchase additional data or your plan renews.' },
    ],
  },
  {
    id: 'billing',
    icon: 'fas fa-credit-card',
    color: 'bg-purple-50 text-purple-600',
    title: 'Billing & Payments',
    description: 'Payment methods, refunds, and invoices',
    faqs: [
      { q: 'What payment methods do you accept?', a: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay.' },
      { q: 'Can I get a refund?', a: 'Unactivated eSIMs are eligible for a full refund within 7 days of purchase. Once activated, refunds are evaluated on a case-by-case basis. Contact our support team for assistance.' },
      { q: 'How do I get a receipt?', a: 'Receipts are automatically sent to your email after purchase. You can also download receipts from your order history in "My Account".' },
    ],
  },
  {
    id: 'troubleshooting',
    icon: 'fas fa-tools',
    color: 'bg-yellow-50 text-yellow-600',
    title: 'Troubleshooting',
    description: 'Solve common issues with your eSIM',
    faqs: [
      { q: 'My eSIM is not connecting', a: 'Make sure data roaming is enabled in your device settings. Go to Settings > Cellular and ensure your eSIM plan is set as the data line. Try toggling airplane mode on and off.' },
      { q: 'The QR code is not scanning', a: 'Ensure you are scanning the QR code displayed on a different device or printout. If using a screenshot, make sure the image is clear and not zoomed in. Contact support if the issue persists.' },
      { q: 'Can I use my eSIM on multiple devices?', a: 'No, each eSIM profile is tied to a single device. If you need to use it on a different device, please contact our support team for assistance with transferring the profile.' },
    ],
  },
];

export const HelpPage = React.memo(function HelpPage({
  config,
  onNavigateToCategory,
  onNavigateToContact,
  t,
}: HelpPageProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            <i className="fas fa-question-circle mr-3" />
            {getText('travelpass.help.title', 'Help Center')}
          </h1>
          <p className="mt-3 text-blue-100 text-lg max-w-2xl mx-auto">
            {getText('travelpass.help.subtitle', 'Find answers to common questions about eSIM activation, data usage, and more')}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Category Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {faqCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                className={cn(
                  'bg-white rounded-lg shadow-sm border p-6 text-left hover:-translate-y-[3px] hover:shadow-md transition-all duration-200',
                  expandedCategory === cat.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200',
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', cat.color.split(' ')[0])}>
                    <i className={cn(cat.icon, cat.color.split(' ')[1])} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">{cat.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{cat.description}</p>
                <div className="mt-3 text-sm text-blue-600 font-medium">
                  {cat.faqs.length} questions <i className="fas fa-chevron-right text-xs ml-1" />
                </div>
              </button>
            ))}
          </div>

          {/* Expanded FAQ Section */}
          {expandedCategory && (
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                {faqCategories.find((c) => c.id === expandedCategory)?.title}
              </h2>
              <div className="space-y-3">
                {faqCategories
                  .find((c) => c.id === expandedCategory)
                  ?.faqs.map((faq) => {
                    const faqKey = `${expandedCategory}-${faq.q}`;
                    const isOpen = expandedFaq === faqKey;
                    return (
                      <div key={faqKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => setExpandedFaq(isOpen ? null : faqKey)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium text-gray-800">{faq.q}</span>
                          <i className={cn('fas text-gray-400 transition-transform', isOpen ? 'fa-chevron-up' : 'fa-chevron-down')} />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4">
                            <p className="text-gray-600 leading-relaxed">{faq.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Still need help */}
          <div className="bg-blue-50 rounded-lg p-6 text-center">
            <i className="fas fa-headset text-blue-600 text-3xl mb-3" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Still need help?</h2>
            <p className="text-gray-600 mb-4">Our support team is available 24/7 to assist you.</p>
            <button
              onClick={onNavigateToContact}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors"
            >
              <i className="fas fa-envelope mr-2" />
              Contact Support
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

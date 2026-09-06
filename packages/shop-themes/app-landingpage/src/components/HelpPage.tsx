/**
 * Help Page — TravelPass Design
 * eSIM FAQ categories and common questions with FA icons.
 */

import React, { useState } from 'react';
import { cn } from '../lib/utils';
import type { HelpPageProps } from '../types';
import { themeText } from '../lib/i18n';

const faqCategories = [
  {
    id: 'getting-started',
    icon: 'fas fa-rocket',
    color: 'bg-blue-50 text-blue-600',
    titleKey: 'faq.gettingStarted.title', descriptionKey: 'faq.gettingStarted.description',
    faqs: [
      { qKey: 'faq.gettingStarted.q1', aKey: 'faq.gettingStarted.a1' },
      { qKey: 'faq.gettingStarted.q2', aKey: 'faq.gettingStarted.a2' },
      { qKey: 'faq.gettingStarted.q3', aKey: 'faq.gettingStarted.a3' },
    ],
  },
  {
    id: 'data-usage',
    icon: 'fas fa-wifi',
    color: 'bg-green-50 text-green-600',
    titleKey: 'faq.dataUsage.title', descriptionKey: 'faq.dataUsage.description',
    faqs: [
      { qKey: 'faq.dataUsage.q1', aKey: 'faq.dataUsage.a1' }, { qKey: 'faq.dataUsage.q2', aKey: 'faq.dataUsage.a2' }, { qKey: 'faq.dataUsage.q3', aKey: 'faq.dataUsage.a3' },
    ],
  },
  {
    id: 'billing',
    icon: 'fas fa-credit-card',
    color: 'bg-purple-50 text-purple-600',
    titleKey: 'faq.billing.title', descriptionKey: 'faq.billing.description',
    faqs: [
      { qKey: 'faq.billing.q1', aKey: 'faq.billing.a1' }, { qKey: 'faq.billing.q2', aKey: 'faq.billing.a2' }, { qKey: 'faq.billing.q3', aKey: 'faq.billing.a3' },
    ],
  },
  {
    id: 'troubleshooting',
    icon: 'fas fa-tools',
    color: 'bg-yellow-50 text-yellow-600',
    titleKey: 'faq.troubleshooting.title', descriptionKey: 'faq.troubleshooting.description',
    faqs: [
      { qKey: 'faq.troubleshooting.q1', aKey: 'faq.troubleshooting.a1' }, { qKey: 'faq.troubleshooting.q2', aKey: 'faq.troubleshooting.a2' }, { qKey: 'faq.troubleshooting.q3', aKey: 'faq.troubleshooting.a3' },
    ],
  },
];

export const HelpPage = React.memo(function HelpPage({
  config,
  onNavigateToCategory,
  onNavigateToContact,
  t,
  locale,
}: HelpPageProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const getText = (key: string, fallback: string): string => {
    return themeText(t, locale, key, fallback);
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
                  <h3 className="text-lg font-semibold text-gray-800">{getText(cat.titleKey, cat.titleKey)}</h3>
                </div>
                <p className="text-sm text-gray-600">{getText(cat.descriptionKey, cat.descriptionKey)}</p>
                <div className="mt-3 text-sm text-blue-600 font-medium">
                  {getText('faq.questions', '{count} questions').replace('{count}', String(cat.faqs.length))} <i className="fas fa-chevron-right text-xs ml-1" />
                </div>
              </button>
            ))}
          </div>

          {/* Expanded FAQ Section */}
          {expandedCategory && (
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                {getText(faqCategories.find((c) => c.id === expandedCategory)?.titleKey || '', '')}
              </h2>
              <div className="space-y-3">
                {faqCategories
                  .find((c) => c.id === expandedCategory)
                  ?.faqs.map((faq) => {
                    const faqKey = `${expandedCategory}-${faq.qKey}`;
                    const isOpen = expandedFaq === faqKey;
                    return (
                      <div key={faqKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => setExpandedFaq(isOpen ? null : faqKey)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium text-gray-800">{getText(faq.qKey, faq.qKey)}</span>
                          <i className={cn('fas text-gray-400 transition-transform', isOpen ? 'fa-chevron-up' : 'fa-chevron-down')} />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4">
                            <p className="text-gray-600 leading-relaxed">{getText(faq.aKey, faq.aKey)}</p>
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{getText('faq.stillNeedHelp', 'Still need help?')}</h2>
            <p className="text-gray-600 mb-4">{getText('faq.supportAvailable', 'Our support team is available 24/7 to assist you.')}</p>
            <button
              onClick={onNavigateToContact}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors"
            >
              <i className="fas fa-envelope mr-2" />
              {getText('faq.contactSupport', 'Contact Support')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

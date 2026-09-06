/**
 * Privacy Policy Page — TravelPass Design
 * eSIM-themed privacy policy with Font Awesome icons and blue palette.
 */

import React from 'react';
import type { PrivacyPageProps } from '../types';
import { themeText } from '../lib/i18n';

const sections = [
  { id: 'information-collect', icon: 'fas fa-file-alt', title: 'Information We Collect', content: 'We collect information you provide directly to us, such as when you create an account, purchase an eSIM package, or contact our support team. This includes your name, email address, payment information, and device details needed for eSIM provisioning.' },
  { id: 'how-we-use', icon: 'fas fa-eye', title: 'How We Use Your Information', content: 'We use the information we collect to provide, maintain, and improve our eSIM services, process transactions, deliver QR codes and activation instructions, and communicate with you about your account and purchases.' },
  { id: 'information-sharing', icon: 'fas fa-users', title: 'Information Sharing', content: 'We do not sell, trade, or otherwise transfer your personal information to third parties without your consent. We may share data with carrier partners solely for eSIM provisioning and activation purposes.' },
  { id: 'data-security', icon: 'fas fa-lock', title: 'Data Security', content: 'We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal information against unauthorized access, alteration, disclosure, or destruction.' },
  { id: 'your-rights', icon: 'fas fa-shield-alt', title: 'Your Rights', content: 'You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us. Contact our privacy team to exercise these rights.' },
  { id: 'contact', icon: 'fas fa-envelope', title: 'Contact Us', content: 'If you have any questions about this Privacy Policy, please contact us at privacy@travelpass.com or through our 24/7 support chat.' },
];

export const PrivacyPage = React.memo(function PrivacyPage({ config, locale, t }: PrivacyPageProps) {
  const tx = (key: string, fallback: string) => themeText(t, locale, key, fallback);
  const date = new Intl.DateTimeFormat(locale === 'zh-Hans' ? 'zh-CN' : locale === 'zh-Hant' ? 'zh-TW' : 'en-US').format(new Date());
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{themeText(t, locale, 'legal.privacy.title', 'Privacy Policy')}</h1>
          <p className="text-blue-100 text-lg">{themeText(t, locale, 'legal.lastUpdated', 'Last updated: {date}', { date })}</p>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-10">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-lg text-gray-600 leading-relaxed">
            {tx('legal.privacy.intro', 'At TravelPass, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our eSIM services.')}
          </p>
        </div>
      </section>

      {/* Policy Sections */}
      <section className="pb-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-5">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className={`${section.icon} text-blue-600`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{tx(`legal.privacy.${section.id}.title`, section.title)}</h3>
                    <p className="text-gray-600 leading-relaxed">{tx(`legal.privacy.${section.id}.content`, section.content)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Information */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">{tx('legal.privacy.cookies.title', 'Cookies and Tracking Technologies')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {tx('legal.privacy.cookies.content', 'We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.')}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">{tx('legal.privacy.links.title', 'Third-Party Links')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {tx('legal.privacy.links.content', 'Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites.')}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">{tx('legal.privacy.children.title', "Children's Privacy")}</h3>
            <p className="text-gray-600 leading-relaxed">
              {tx('legal.privacy.children.content', 'Our website is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.')}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">{tx('legal.privacy.changes.title', 'Changes to This Privacy Policy')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {tx('legal.privacy.changes.content', 'We may update this Privacy Policy from time to time to reflect changes in our practices or for operational, legal, or regulatory reasons.')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
});

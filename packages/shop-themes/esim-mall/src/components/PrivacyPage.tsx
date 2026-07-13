/**
 * Privacy Policy Page — TravelPass Design
 * eSIM-themed privacy policy with Font Awesome icons and blue palette.
 */

import React from 'react';
import type { PrivacyPageProps } from '../types';

const sections = [
  { id: 'information-collect', icon: 'fas fa-file-alt', title: 'Information We Collect', content: 'We collect information you provide directly to us, such as when you create an account, purchase an eSIM package, or contact our support team. This includes your name, email address, payment information, and device details needed for eSIM provisioning.' },
  { id: 'how-we-use', icon: 'fas fa-eye', title: 'How We Use Your Information', content: 'We use the information we collect to provide, maintain, and improve our eSIM services, process transactions, deliver QR codes and activation instructions, and communicate with you about your account and purchases.' },
  { id: 'information-sharing', icon: 'fas fa-users', title: 'Information Sharing', content: 'We do not sell, trade, or otherwise transfer your personal information to third parties without your consent. We may share data with carrier partners solely for eSIM provisioning and activation purposes.' },
  { id: 'data-security', icon: 'fas fa-lock', title: 'Data Security', content: 'We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal information against unauthorized access, alteration, disclosure, or destruction.' },
  { id: 'your-rights', icon: 'fas fa-shield-alt', title: 'Your Rights', content: 'You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us. Contact our privacy team to exercise these rights.' },
  { id: 'contact', icon: 'fas fa-envelope', title: 'Contact Us', content: 'If you have any questions about this Privacy Policy, please contact us at privacy@travelpass.com or through our 24/7 support chat.' },
];

export const PrivacyPage = React.memo(function PrivacyPage({ config }: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-blue-100 text-lg">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-10">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-lg text-gray-600 leading-relaxed">
            At TravelPass, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our eSIM services.
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
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{section.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{section.content}</p>
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
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Cookies and Tracking Technologies</h3>
            <p className="text-gray-600 leading-relaxed">
              We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Third-Party Links</h3>
            <p className="text-gray-600 leading-relaxed">
              Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Children&apos;s Privacy</h3>
            <p className="text-gray-600 leading-relaxed">
              Our website is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Changes to This Privacy Policy</h3>
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
});

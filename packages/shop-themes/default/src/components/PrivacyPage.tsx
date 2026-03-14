/**
 * Privacy Policy Page Component - Admin Style Design
 */

import React from 'react';
import { Shield, Eye, Lock, Users, FileText } from 'lucide-react';
import type { PrivacyPageProps } from '../../../../shared/src/types/theme';

export function PrivacyPage({ config }: PrivacyPageProps) {
  const sections = [
    { id: 'information-collect', icon: FileText, title: 'Information We Collect', content: 'We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us.' },
    { id: 'how-we-use', icon: Eye, title: 'How We Use Your Information', content: 'We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.' },
    { id: 'information-sharing', icon: Users, title: 'Information Sharing', content: 'We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.' },
    { id: 'data-security', icon: Lock, title: 'Data Security', content: 'We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.' },
    { id: 'your-rights', icon: Shield, title: 'Your Rights', content: 'You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us.' },
    { id: 'contact', icon: FileText, title: 'Contact Us', content: 'If you have any questions about this Privacy Policy, please contact us at privacy@jiffoomall.com.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <section className="py-16 sm:py-20 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-6">
              <Shield className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">PRIVACY POLICY</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Privacy Policy</h1>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              LAST UPDATED: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              At Jiffoo Mall, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </div>
        </div>
      </section>

      {/* Policy Sections */}
      <section className="py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-4 sm:space-y-6">
            {sections.map((section) => {
              const IconComponent = section.icon;
              return (
                <div
                  key={section.id}
                  className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 tracking-tight">{section.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{section.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Additional Information */}
      <section className="py-12 sm:py-16 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">COOKIES & TRACKING</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">THIRD-PARTY LINKS</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies before providing any personal information.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">CHILDREN'S PRIVACY</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Our website is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl border border-gray-100 dark:border-slate-600 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">POLICY CHANGES</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

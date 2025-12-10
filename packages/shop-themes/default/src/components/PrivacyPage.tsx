/**
 * 隐私政策页面组件
 * 展示隐私政策内容
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <section className="py-16 bg-gradient-to-br from-brand-50 via-white to-purple-50">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">Privacy Policy</h1>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">Last updated: {new Date().toLocaleDateString()}</p>
          </motion.div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <p className="text-lg text-neutral-500 leading-relaxed">
              At Jiffoo Mall, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Policy Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-6">
            {sections.map((section, index) => {
              const IconComponent = section.icon;
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 + index * 0.05 }}
                  className="bg-white rounded-2xl border border-neutral-100 p-6"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-neutral-900 mb-2">{section.title}</h3>
                      <p className="text-neutral-500 leading-relaxed">{section.content}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Additional Information */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="space-y-8">
            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Cookies and Tracking Technologies</h3>
              <p className="text-neutral-500 leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Third-Party Links</h3>
              <p className="text-neutral-500 leading-relaxed">
                Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies before providing any personal information.
              </p>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Children's Privacy</h3>
              <p className="text-neutral-500 leading-relaxed">
                Our website is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
              </p>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">Changes to This Privacy Policy</h3>
              <p className="text-neutral-500 leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}


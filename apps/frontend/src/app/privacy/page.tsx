'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, Lock, Users, FileText, Calendar } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export default function PrivacyPage() {
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Privacy Policy',
      subtitle: 'Your privacy is important to us. Learn how we collect, use, and protect your information.',
      lastUpdated: 'Last updated',
      tableOfContents: 'Table of Contents',
      informationWeCollect: 'Information We Collect',
      howWeUseInfo: 'How We Use Your Information',
      informationSharing: 'Information Sharing',
      dataSecurity: 'Data Security',
      yourRights: 'Your Rights',
      contactUs: 'Contact Us',
      // Content sections
      infoCollectTitle: '1. Information We Collect',
      infoCollectContent: 'We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support.',
      howUseTitle: '2. How We Use Your Information',
      howUseContent: 'We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.',
      sharingTitle: '3. Information Sharing',
      sharingContent: 'We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.',
      securityTitle: '4. Data Security',
      securityContent: 'We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.',
      rightsTitle: '5. Your Rights',
      rightsContent: 'You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us.',
      contactTitle: '6. Contact Us',
      contactContent: 'If you have any questions about this Privacy Policy, please contact us at privacy@jiffoo.com.',
    },
    'zh-CN': {
      title: '隐私政策',
      subtitle: '您的隐私对我们很重要。了解我们如何收集、使用和保护您的信息。',
      lastUpdated: '最后更新',
      tableOfContents: '目录',
      informationWeCollect: '我们收集的信息',
      howWeUseInfo: '我们如何使用您的信息',
      informationSharing: '信息共享',
      dataSecurity: '数据安全',
      yourRights: '您的权利',
      contactUs: '联系我们',
      // Content sections
      infoCollectTitle: '1. 我们收集的信息',
      infoCollectContent: '我们收集您直接提供给我们的信息，例如当您创建账户、购买商品或联系我们寻求支持时。',
      howUseTitle: '2. 我们如何使用您的信息',
      howUseContent: '我们使用收集的信息来提供、维护和改进我们的服务，处理交易，并与您沟通。',
      sharingTitle: '3. 信息共享',
      sharingContent: '除本政策中描述的情况外，我们不会在未经您同意的情况下出售、交易或以其他方式将您的个人信息转让给第三方。',
      securityTitle: '4. 数据安全',
      securityContent: '我们实施适当的安全措施来保护您的个人信息免受未经授权的访问、更改、披露或销毁。',
      rightsTitle: '5. 您的权利',
      rightsContent: '您有权访问、更新或删除您的个人信息。您也可以选择不接收我们的某些通信。',
      contactTitle: '6. 联系我们',
      contactContent: '如果您对本隐私政策有任何疑问，请通过 privacy@jiffoo.com 联系我们。',
    },
    'ja-JP': {
      title: 'プライバシーポリシー',
      subtitle: 'お客様のプライバシーは私たちにとって重要です。情報の収集、使用、保護方法について説明します。',
      lastUpdated: '最終更新',
      tableOfContents: '目次',
      informationWeCollect: '収集する情報',
      howWeUseInfo: '情報の使用方法',
      informationSharing: '情報の共有',
      dataSecurity: 'データセキュリティ',
      yourRights: 'お客様の権利',
      contactUs: 'お問い合わせ',
      // Content sections
      infoCollectTitle: '1. 収集する情報',
      infoCollectContent: 'アカウント作成、購入、サポートへの連絡など、お客様が直接提供する情報を収集します。',
      howUseTitle: '2. 情報の使用方法',
      howUseContent: '収集した情報は、サービスの提供、維持、改善、取引の処理、お客様との連絡に使用します。',
      sharingTitle: '3. 情報の共有',
      sharingContent: 'このポリシーに記載されている場合を除き、お客様の同意なしに個人情報を第三者に販売、取引、または譲渡することはありません。',
      securityTitle: '4. データセキュリティ',
      securityContent: '不正アクセス、改変、開示、破壊からお客様の個人情報を保護するため、適切なセキュリティ対策を実施しています。',
      rightsTitle: '5. お客様の権利',
      rightsContent: 'お客様は個人情報へのアクセス、更新、削除の権利があります。また、当社からの特定の通信をオプトアウトすることもできます。',
      contactTitle: '6. お問い合わせ',
      contactContent: 'このプライバシーポリシーについてご質問がございましたら、privacy@jiffoo.com までお問い合わせください。',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const sections = [
    {
      id: 'information-collect',
      icon: FileText,
      title: t('infoCollectTitle'),
      content: t('infoCollectContent'),
    },
    {
      id: 'how-we-use',
      icon: Eye,
      title: t('howUseTitle'),
      content: t('howUseContent'),
    },
    {
      id: 'information-sharing',
      icon: Users,
      title: t('sharingTitle'),
      content: t('sharingContent'),
    },
    {
      id: 'data-security',
      icon: Lock,
      title: t('securityTitle'),
      content: t('securityContent'),
    },
    {
      id: 'your-rights',
      icon: Shield,
      title: t('rightsTitle'),
      content: t('rightsContent'),
    },
    {
      id: 'contact',
      icon: FileText,
      title: t('contactTitle'),
      content: t('contactContent'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-16 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              <span>Privacy Protected</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg text-muted-foreground mb-6">
              {t('subtitle')}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{t('lastUpdated')}: May 28, 2024</span>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Table of Contents */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-1"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 sticky top-4">
              <h3 className="font-semibold text-lg mb-4">{t('tableOfContents')}</h3>
              <nav className="space-y-2">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-muted/50"
                  >
                    <section.icon className="h-4 w-4" />
                    <span>{section.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
              <div className="prose prose-gray dark:prose-invert max-w-none">
                {sections.map((section, index) => (
                  <motion.section
                    key={section.id}
                    id={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="mb-12 last:mb-0"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <section.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold">{section.title}</h2>
                    </div>
                    <div className="text-muted-foreground leading-relaxed">
                      <p>{section.content}</p>
                      
                      {/* Additional detailed content for each section */}
                      {section.id === 'information-collect' && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-semibold text-foreground">Types of information we collect:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Account information (name, email, password)</li>
                            <li>Purchase history and preferences</li>
                            <li>Device and usage information</li>
                            <li>Communication records</li>
                          </ul>
                        </div>
                      )}
                      
                      {section.id === 'data-security' && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-semibold text-foreground">Security measures include:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            <li>SSL encryption for data transmission</li>
                            <li>Secure data storage with encryption</li>
                            <li>Regular security audits and updates</li>
                            <li>Access controls and authentication</li>
                          </ul>
                        </div>
                      )}
                      
                      {section.id === 'your-rights' && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-semibold text-foreground">Your rights include:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Right to access your personal data</li>
                            <li>Right to correct inaccurate information</li>
                            <li>Right to delete your account and data</li>
                            <li>Right to data portability</li>
                            <li>Right to opt-out of marketing communications</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.section>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Contact Section */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="text-3xl font-bold mb-4">Questions About Privacy?</h2>
            <p className="text-muted-foreground mb-8">
              If you have any questions or concerns about our privacy practices, 
              we're here to help. Contact our privacy team directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:privacy@jiffoo.com"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FileText className="h-4 w-4" />
                privacy@jiffoo.com
              </a>
              <a
                href="/contact"
                className="inline-flex items-center gap-2 border border-primary text-primary px-6 py-3 rounded-lg hover:bg-primary/10 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Contact Form
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { FileText, Scale, Shield, AlertTriangle, Calendar, CheckCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export default function TermsPage() {
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Terms of Service',
      subtitle: 'Please read these terms carefully before using our services.',
      lastUpdated: 'Last updated',
      tableOfContents: 'Table of Contents',
      acceptance: 'Acceptance of Terms',
      useOfService: 'Use of Service',
      userAccounts: 'User Accounts',
      purchases: 'Purchases and Payments',
      shipping: 'Shipping and Delivery',
      returns: 'Returns and Refunds',
      prohibited: 'Prohibited Uses',
      intellectual: 'Intellectual Property',
      limitation: 'Limitation of Liability',
      termination: 'Termination',
      governing: 'Governing Law',
      contactUs: 'Contact Us',
      // Content
      acceptanceTitle: '1. Acceptance of Terms',
      acceptanceContent: 'By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.',
      useTitle: '2. Use of Service',
      useContent: 'You may use our service for lawful purposes only. You agree not to use the service in any way that violates any applicable laws or regulations.',
      accountsTitle: '3. User Accounts',
      accountsContent: 'When you create an account with us, you must provide information that is accurate, complete, and current at all times.',
      purchasesTitle: '4. Purchases and Payments',
      purchasesContent: 'All purchases are subject to product availability. We reserve the right to refuse or cancel any order for any reason.',
      shippingTitle: '5. Shipping and Delivery',
      shippingContent: 'We will make every effort to deliver products within the estimated timeframe, but delivery times are not guaranteed.',
      returnsTitle: '6. Returns and Refunds',
      returnsContent: 'You may return most items within 30 days of delivery for a full refund, subject to our return policy.',
    },
    'zh-CN': {
      title: '服务条款',
      subtitle: '在使用我们的服务之前，请仔细阅读这些条款。',
      lastUpdated: '最后更新',
      tableOfContents: '目录',
      acceptance: '条款接受',
      useOfService: '服务使用',
      userAccounts: '用户账户',
      purchases: '购买和付款',
      shipping: '配送和交付',
      returns: '退货和退款',
      prohibited: '禁止使用',
      intellectual: '知识产权',
      limitation: '责任限制',
      termination: '终止',
      governing: '适用法律',
      contactUs: '联系我们',
      // Content
      acceptanceTitle: '1. 条款接受',
      acceptanceContent: '通过访问和使用本网站，您接受并同意受本协议条款和条件的约束。',
      useTitle: '2. 服务使用',
      useContent: '您只能将我们的服务用于合法目的。您同意不以违反任何适用法律或法规的方式使用服务。',
      accountsTitle: '3. 用户账户',
      accountsContent: '当您在我们这里创建账户时，您必须始终提供准确、完整和最新的信息。',
      purchasesTitle: '4. 购买和付款',
      purchasesContent: '所有购买都取决于产品的可用性。我们保留因任何原因拒绝或取消任何订单的权利。',
      shippingTitle: '5. 配送和交付',
      shippingContent: '我们将尽一切努力在预计时间内交付产品，但交付时间不能保证。',
      returnsTitle: '6. 退货和退款',
      returnsContent: '您可以在交付后30天内退回大多数商品以获得全额退款，但须遵守我们的退货政策。',
    },
    'ja-JP': {
      title: '利用規約',
      subtitle: 'サービスをご利用になる前に、これらの規約をよくお読みください。',
      lastUpdated: '最終更新',
      tableOfContents: '目次',
      acceptance: '規約の承諾',
      useOfService: 'サービスの利用',
      userAccounts: 'ユーザーアカウント',
      purchases: '購入と支払い',
      shipping: '配送と納期',
      returns: '返品と返金',
      prohibited: '禁止事項',
      intellectual: '知的財産',
      limitation: '責任の制限',
      termination: '終了',
      governing: '準拠法',
      contactUs: 'お問い合わせ',
      // Content
      acceptanceTitle: '1. 規約の承諾',
      acceptanceContent: 'このウェブサイトにアクセスし使用することにより、お客様はこの契約の条項と条件に拘束されることに同意し承諾します。',
      useTitle: '2. サービスの利用',
      useContent: '当サービスは合法的な目的でのみご利用いただけます。適用される法律や規制に違反する方法でサービスを使用しないことに同意します。',
      accountsTitle: '3. ユーザーアカウント',
      accountsContent: '当社でアカウントを作成する際は、常に正確で完全かつ最新の情報を提供する必要があります。',
      purchasesTitle: '4. 購入と支払い',
      purchasesContent: 'すべての購入は商品の在庫状況に依存します。当社は理由を問わず注文を拒否またはキャンセルする権利を留保します。',
      shippingTitle: '5. 配送と納期',
      shippingContent: '予定された時間枠内での商品配送に最善を尽くしますが、配送時間は保証されません。',
      returnsTitle: '6. 返品と返金',
      returnsContent: '返品ポリシーに従い、配送後30日以内にほとんどの商品を返品して全額返金を受けることができます。',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const sections = [
    {
      id: 'acceptance',
      icon: CheckCircle,
      title: t('acceptanceTitle'),
      content: t('acceptanceContent'),
    },
    {
      id: 'use-of-service',
      icon: Shield,
      title: t('useTitle'),
      content: t('useContent'),
    },
    {
      id: 'user-accounts',
      icon: FileText,
      title: t('accountsTitle'),
      content: t('accountsContent'),
    },
    {
      id: 'purchases',
      icon: Scale,
      title: t('purchasesTitle'),
      content: t('purchasesContent'),
    },
    {
      id: 'shipping',
      icon: FileText,
      title: t('shippingTitle'),
      content: t('shippingContent'),
    },
    {
      id: 'returns',
      icon: AlertTriangle,
      title: t('returnsTitle'),
      content: t('returnsContent'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-16 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Scale className="h-4 w-4" />
              <span>Legal Terms</span>
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
                      
                      {/* Additional content for specific sections */}
                      {section.id === 'acceptance' && (
                        <div className="mt-4 space-y-3">
                          <p>If you disagree with any part of these terms, then you may not access the service.</p>
                          <p>These Terms of Service constitute the entire agreement between us regarding our service.</p>
                        </div>
                      )}
                      
                      {section.id === 'use-of-service' && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-semibold text-foreground">Prohibited activities include:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Violating any applicable laws or regulations</li>
                            <li>Transmitting harmful or malicious code</li>
                            <li>Attempting to gain unauthorized access</li>
                            <li>Interfering with the service's operation</li>
                          </ul>
                        </div>
                      )}
                      
                      {section.id === 'purchases' && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-semibold text-foreground">Payment terms:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            <li>All prices are in USD unless otherwise stated</li>
                            <li>Payment is due at the time of purchase</li>
                            <li>We accept major credit cards and PayPal</li>
                            <li>Taxes may apply based on your location</li>
                          </ul>
                        </div>
                      )}
                      
                      {section.id === 'returns' && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-semibold text-foreground">Return conditions:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Items must be in original condition</li>
                            <li>Original packaging and tags required</li>
                            <li>Some items may not be eligible for return</li>
                            <li>Return shipping costs may apply</li>
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
            <h2 className="text-3xl font-bold mb-4">Questions About Our Terms?</h2>
            <p className="text-muted-foreground mb-8">
              If you have any questions about these Terms of Service, 
              please don't hesitate to contact our legal team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:legal@jiffoo.com"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Scale className="h-4 w-4" />
                legal@jiffoo.com
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

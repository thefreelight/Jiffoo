'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Search, HelpCircle, MessageCircle, Phone, Mail, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import Link from 'next/link';

const helpCategories = [
  {
    id: 'orders',
    icon: '📦',
    titleEn: 'Orders & Shipping',
    titleZh: '订单与配送',
    titleJa: '注文と配送',
    descEn: 'Track orders, shipping info, and delivery questions',
    descZh: '跟踪订单、配送信息和交付问题',
    descJa: '注文の追跡、配送情報、配達に関する質問',
    articles: 12,
  },
  {
    id: 'returns',
    icon: '↩️',
    titleEn: 'Returns & Refunds',
    titleZh: '退货与退款',
    titleJa: '返品と返金',
    descEn: 'Return policy, refund process, and exchanges',
    descZh: '退货政策、退款流程和换货',
    descJa: '返品ポリシー、返金プロセス、交換',
    articles: 8,
  },
  {
    id: 'account',
    icon: '👤',
    titleEn: 'Account & Profile',
    titleZh: '账户与个人资料',
    titleJa: 'アカウントとプロフィール',
    descEn: 'Manage your account, password, and personal info',
    descZh: '管理您的账户、密码和个人信息',
    descJa: 'アカウント、パスワード、個人情報の管理',
    articles: 6,
  },
  {
    id: 'payment',
    icon: '💳',
    titleEn: 'Payment & Billing',
    titleZh: '支付与账单',
    titleJa: '支払いと請求',
    descEn: 'Payment methods, billing issues, and invoices',
    descZh: '支付方式、账单问题和发票',
    descJa: '支払い方法、請求の問題、請求書',
    articles: 10,
  },
  {
    id: 'products',
    icon: '🛍️',
    titleEn: 'Products & Catalog',
    titleZh: '商品与目录',
    titleJa: '商品とカタログ',
    descEn: 'Product information, availability, and specifications',
    descZh: '商品信息、库存和规格',
    descJa: '商品情報、在庫状況、仕様',
    articles: 15,
  },
  {
    id: 'technical',
    icon: '⚙️',
    titleEn: 'Technical Support',
    titleZh: '技术支持',
    titleJa: 'テクニカルサポート',
    descEn: 'Website issues, app problems, and technical help',
    descZh: '网站问题、应用程序问题和技术帮助',
    descJa: 'ウェブサイトの問題、アプリの問題、技術的なヘルプ',
    articles: 7,
  },
];

const popularArticles = [
  {
    id: 1,
    titleEn: 'How to track my order?',
    titleZh: '如何跟踪我的订单？',
    titleJa: '注文を追跡するには？',
    category: 'orders',
    views: 1234,
  },
  {
    id: 2,
    titleEn: 'What is your return policy?',
    titleZh: '您的退货政策是什么？',
    titleJa: '返品ポリシーは何ですか？',
    category: 'returns',
    views: 987,
  },
  {
    id: 3,
    titleEn: 'How to change my password?',
    titleZh: '如何更改我的密码？',
    titleJa: 'パスワードを変更するには？',
    category: 'account',
    views: 756,
  },
  {
    id: 4,
    titleEn: 'Payment methods accepted',
    titleZh: '接受的支付方式',
    titleJa: '受け入れられる支払い方法',
    category: 'payment',
    views: 654,
  },
];

export default function HelpPage() {
  const { currentLanguage } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Help Center',
      subtitle: 'How can we help you today?',
      searchPlaceholder: 'Search for help articles...',
      searchButton: 'Search',
      browseCategories: 'Browse Categories',
      popularArticles: 'Popular Articles',
      articles: 'articles',
      views: 'views',
      contactSupport: 'Contact Support',
      contactDesc: "Can't find what you're looking for? Our support team is here to help.",
      liveChat: 'Live Chat',
      liveChatDesc: 'Chat with our support team',
      emailSupport: 'Email Support',
      emailSupportDesc: 'Send us an email',
      phoneSupport: 'Phone Support',
      phoneSupportDesc: 'Call our support line',
      businessHours: 'Mon-Fri 9AM-6PM EST',
      getStarted: 'Get Started',
      needMoreHelp: 'Need More Help?',
    },
    'zh-CN': {
      title: '帮助中心',
      subtitle: '今天我们可以为您提供什么帮助？',
      searchPlaceholder: '搜索帮助文章...',
      searchButton: '搜索',
      browseCategories: '浏览分类',
      popularArticles: '热门文章',
      articles: '篇文章',
      views: '次查看',
      contactSupport: '联系客服',
      contactDesc: '找不到您要找的内容？我们的客服团队随时为您提供帮助。',
      liveChat: '在线客服',
      liveChatDesc: '与我们的客服团队聊天',
      emailSupport: '邮件客服',
      emailSupportDesc: '发送邮件给我们',
      phoneSupport: '电话客服',
      phoneSupportDesc: '拨打我们的客服热线',
      businessHours: '周一至周五 上午9点-下午6点',
      getStarted: '开始使用',
      needMoreHelp: '需要更多帮助？',
    },
    'ja-JP': {
      title: 'ヘルプセンター',
      subtitle: '今日はどのようなお手伝いができますか？',
      searchPlaceholder: 'ヘルプ記事を検索...',
      searchButton: '検索',
      browseCategories: 'カテゴリーを閲覧',
      popularArticles: '人気記事',
      articles: '記事',
      views: '回表示',
      contactSupport: 'サポートに連絡',
      contactDesc: 'お探しのものが見つかりませんか？サポートチームがお手伝いします。',
      liveChat: 'ライブチャット',
      liveChatDesc: 'サポートチームとチャット',
      emailSupport: 'メールサポート',
      emailSupportDesc: 'メールを送信',
      phoneSupport: '電話サポート',
      phoneSupportDesc: 'サポートラインに電話',
      businessHours: '月-金 午前9時-午後6時 EST',
      getStarted: '始める',
      needMoreHelp: 'さらにサポートが必要ですか？',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const getCategoryTitle = (category: any) => {
    switch (currentLanguage) {
      case 'zh-CN':
        return category.titleZh;
      case 'ja-JP':
        return category.titleJa;
      default:
        return category.titleEn;
    }
  };

  const getCategoryDesc = (category: any) => {
    switch (currentLanguage) {
      case 'zh-CN':
        return category.descZh;
      case 'ja-JP':
        return category.descJa;
      default:
        return category.descEn;
    }
  };

  const getArticleTitle = (article: any) => {
    switch (currentLanguage) {
      case 'zh-CN':
        return article.titleZh;
      case 'ja-JP':
        return article.titleJa;
      default:
        return article.titleEn;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would perform the search
    console.log('Searching for:', searchQuery);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-16 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg text-muted-foreground mb-8">
              {t('subtitle')}
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-lg"
                  />
                </div>
                <Button type="submit" size="lg">
                  {t('searchButton')}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold text-center mb-4">{t('browseCategories')}</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {helpCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link href={`/help/${category.id}`} className="group block">
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 p-6 h-full">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{category.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                          {getCategoryTitle(category)}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-3">
                          {getCategoryDesc(category)}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {category.articles} {t('articles')}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold text-center mb-4">{t('popularArticles')}</h2>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
              {popularArticles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Link href={`/help/article/${article.id}`} className="group block">
                    <div className="p-6 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-lg mb-1 group-hover:text-primary transition-colors">
                            {getArticleTitle(article)}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{article.views.toLocaleString()} {t('views')}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">{t('needMoreHelp')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('contactDesc')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 text-center h-full">
                <div className="bg-green-100 dark:bg-green-900/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{t('liveChat')}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {t('liveChatDesc')}
                </p>
                <Button className="w-full">
                  {t('getStarted')}
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 text-center h-full">
                <div className="bg-blue-100 dark:bg-blue-900/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{t('emailSupport')}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {t('emailSupportDesc')}
                </p>
                <Button variant="outline" className="w-full">
                  support@jiffoo.com
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 text-center h-full">
                <div className="bg-purple-100 dark:bg-purple-900/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{t('phoneSupport')}</h3>
                <p className="text-muted-foreground text-sm mb-2">
                  {t('phoneSupportDesc')}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {t('businessHours')}
                </p>
                <Button variant="outline" className="w-full">
                  +1 (555) 123-4567
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}

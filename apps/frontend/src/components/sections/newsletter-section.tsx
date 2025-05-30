'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mail, Gift, Bell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toaster';
import { useTranslation } from '@/hooks/use-translation';

export function NewsletterSection() {
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Stay in the Loop',
      subtitle: 'Subscribe to our newsletter and be the first to know about new products, exclusive deals, and special offers.',
      exclusiveDeals: 'Exclusive Deals',
      exclusiveDealsDesc: 'Get access to subscriber-only discounts and promotions',
      earlyAccess: 'Early Access',
      earlyAccessDesc: 'Be the first to shop new arrivals and limited editions',
      styleTips: 'Style Tips',
      styleTipsDesc: 'Receive curated content and styling recommendations',
      emailPlaceholder: 'Enter your email address',
      subscribeNow: 'Subscribe Now',
      privacyText: 'By subscribing, you agree to our',
      privacyPolicy: 'Privacy Policy',
      privacyConsent: 'and consent to receive updates from our company.',
      socialProof: 'Join 25,000+ subscribers who love our updates',
      andMore: 'and many more...',
      emailRequired: 'Email Required',
      emailRequiredDesc: 'Please enter your email address.',
      successTitle: 'Successfully Subscribed!',
      successDesc: 'Thank you for subscribing to our newsletter.',
    },
    'zh-CN': {
      title: '保持联系',
      subtitle: '订阅我们的新闻通讯，第一时间了解新产品、独家优惠和特别活动。',
      exclusiveDeals: '独家优惠',
      exclusiveDealsDesc: '获得订阅者专享折扣和促销活动',
      earlyAccess: '抢先体验',
      earlyAccessDesc: '率先购买新品和限量版商品',
      styleTips: '搭配建议',
      styleTipsDesc: '接收精选内容和搭配推荐',
      emailPlaceholder: '请输入您的邮箱地址',
      subscribeNow: '立即订阅',
      privacyText: '订阅即表示您同意我们的',
      privacyPolicy: '隐私政策',
      privacyConsent: '并同意接收我们公司的更新信息。',
      socialProof: '加入 25,000+ 喜爱我们更新的订阅者',
      andMore: '还有更多...',
      emailRequired: '邮箱必填',
      emailRequiredDesc: '请输入您的邮箱地址。',
      successTitle: '订阅成功！',
      successDesc: '感谢您订阅我们的新闻通讯。',
    },
    'ja-JP': {
      title: '最新情報をお届け',
      subtitle: 'ニュースレターを購読して、新商品、限定セール、特別オファーを最初にお知らせします。',
      exclusiveDeals: '限定セール',
      exclusiveDealsDesc: '購読者限定の割引とプロモーションにアクセス',
      earlyAccess: '先行アクセス',
      earlyAccessDesc: '新着商品や限定版を最初にお買い物',
      styleTips: 'スタイルのヒント',
      styleTipsDesc: '厳選されたコンテンツとスタイリング推奨を受信',
      emailPlaceholder: 'メールアドレスを入力してください',
      subscribeNow: '今すぐ購読',
      privacyText: '購読することで、当社の',
      privacyPolicy: 'プライバシーポリシー',
      privacyConsent: 'に同意し、当社からの更新情報の受信に同意したものとみなされます。',
      socialProof: '私たちの更新を愛する 25,000+ 人の購読者に参加',
      andMore: 'その他多数...',
      emailRequired: 'メール必須',
      emailRequiredDesc: 'メールアドレスを入力してください。',
      successTitle: '購読成功！',
      successDesc: 'ニュースレターの購読ありがとうございます。',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: t('emailRequired'),
        description: t('emailRequiredDesc'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setEmail('');
      toast({
        title: t('successTitle'),
        description: t('successDesc'),
      });
    }, 1000);
  };

  return (
    <section className="py-16 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              {t('title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          >
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20">
                <Gift className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold">{t('exclusiveDeals')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('exclusiveDealsDesc')}
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20">
                <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold">{t('earlyAccess')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('earlyAccessDesc')}
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20">
                <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold">{t('styleTips')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('styleTipsDesc')}
              </p>
            </div>
          </motion.div>

          {/* Newsletter Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="bg-background/50 backdrop-blur-sm rounded-2xl p-8 border shadow-lg"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12"
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  loading={isLoading}
                  className="sm:w-auto w-full"
                >
                  {t('subscribeNow')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {t('privacyText')}{' '}
                <a href="/privacy" className="underline hover:text-foreground">
                  {t('privacyPolicy')}
                </a>{' '}
                {t('privacyConsent')}
              </p>
            </form>

            {/* Social Proof */}
            <div className="mt-8 pt-6 border-t text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {t('socialProof')}
              </p>
              <div className="flex justify-center items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold"
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {t('andMore')}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

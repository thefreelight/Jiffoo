'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, Package, Star, Truck } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';



export function StatsSection() {
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Trusted by Thousands',
      subtitle: 'Join our growing community of satisfied customers who trust us for their shopping needs',
      happyCustomers: 'Happy Customers',
      happyCustomersDesc: 'Satisfied customers worldwide',
      productsSold: 'Products Sold',
      productsSoldDesc: 'Quality products delivered',
      customerRating: 'Customer Rating',
      customerRatingDesc: 'Based on 5,000+ reviews',
      onTimeDelivery: 'On-Time Delivery',
      onTimeDeliveryDesc: 'Fast and reliable shipping',
      whyChoose: 'Why Choose Jiffoo Mall?',
      premiumQuality: 'Premium Quality',
      premiumQualityDesc: 'Carefully curated products from trusted brands',
      fastShipping: 'Fast Shipping',
      fastShippingDesc: 'Free delivery on orders over $50 worldwide',
      support247: '24/7 Support',
      support247Desc: 'Round-the-clock customer service assistance',
    },
    'zh-CN': {
      title: '万千用户信赖',
      subtitle: '加入我们不断增长的满意客户社区，他们信任我们满足他们的购物需求',
      happyCustomers: '满意客户',
      happyCustomersDesc: '全球满意客户',
      productsSold: '销售商品',
      productsSoldDesc: '优质商品交付',
      customerRating: '客户评分',
      customerRatingDesc: '基于 5,000+ 条评价',
      onTimeDelivery: '准时配送',
      onTimeDeliveryDesc: '快速可靠的配送',
      whyChoose: '为什么选择 Jiffoo 商城？',
      premiumQuality: '优质品质',
      premiumQualityDesc: '精心挑选来自可信品牌的产品',
      fastShipping: '快速配送',
      fastShippingDesc: '全球订单满 $50 免费配送',
      support247: '24/7 客服',
      support247Desc: '全天候客户服务支持',
    },
    'ja-JP': {
      title: '数千人に信頼されています',
      subtitle: 'ショッピングニーズを信頼してくださる満足顧客の成長するコミュニティにご参加ください',
      happyCustomers: '満足顧客',
      happyCustomersDesc: '世界中の満足顧客',
      productsSold: '販売商品',
      productsSoldDesc: '高品質商品の配送',
      customerRating: '顧客評価',
      customerRatingDesc: '5,000+ レビューに基づく',
      onTimeDelivery: '時間通り配送',
      onTimeDeliveryDesc: '迅速で信頼性の高い配送',
      whyChoose: 'なぜJiffoo Mallを選ぶのか？',
      premiumQuality: 'プレミアム品質',
      premiumQualityDesc: '信頼できるブランドから厳選された商品',
      fastShipping: '高速配送',
      fastShippingDesc: '世界中で$50以上のご注文で送料無料',
      support247: '24/7 サポート',
      support247Desc: '24時間体制のカスタマーサービス',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  // 动态统计数据
  const getStats = () => [
    {
      icon: Users,
      value: '50K+',
      label: t('happyCustomers'),
      description: t('happyCustomersDesc'),
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      icon: Package,
      value: '10K+',
      label: t('productsSold'),
      description: t('productsSoldDesc'),
      color: 'text-green-600 dark:text-green-400'
    },
    {
      icon: Star,
      value: '4.9/5',
      label: t('customerRating'),
      description: t('customerRatingDesc'),
      color: 'text-yellow-600 dark:text-yellow-400'
    },
    {
      icon: Truck,
      value: '99%',
      label: t('onTimeDelivery'),
      description: t('onTimeDeliveryDesc'),
      color: 'text-purple-600 dark:text-purple-400'
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-r from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {getStats().map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <div className="relative">
                  {/* Icon Background */}
                  <div className="mx-auto w-16 h-16 rounded-full bg-background shadow-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className={`h-8 w-8 ${stat.color}`} />
                  </div>

                  {/* Animated Ring */}
                  <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-primary/20 group-hover:border-primary/40 transition-colors duration-300" />
                </div>

                {/* Stats */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                  viewport={{ once: true }}
                  className="space-y-2"
                >
                  <div className="text-3xl lg:text-4xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {stat.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.description}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="bg-background/50 backdrop-blur-sm rounded-2xl p-8 border shadow-lg max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">{t('whyChoose')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-2">
                <div className="font-semibold">{t('premiumQuality')}</div>
                <div className="text-muted-foreground">
                  {t('premiumQualityDesc')}
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold">{t('fastShipping')}</div>
                <div className="text-muted-foreground">
                  {t('fastShippingDesc')}
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold">{t('support247')}</div>
                <div className="text-muted-foreground">
                  {t('support247Desc')}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

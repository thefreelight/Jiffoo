'use client';

import Link from 'next/link';
import { Facebook, Twitter, Instagram, Github, Mail, Phone, MapPin } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

export function Footer() {
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      description: 'Modern e-commerce platform built with cutting-edge technology. Fast, secure, and beautiful shopping experience.',
      quickLinks: 'Quick Links',
      allProducts: 'All Products',
      categories: 'Categories',
      specialDeals: 'Special Deals',
      newArrivals: 'New Arrivals',
      bestSellers: 'Best Sellers',
      customerService: 'Customer Service',
      helpCenter: 'Help Center',
      contactUs: 'Contact Us',
      shippingInfo: 'Shipping Info',
      returnsExchanges: 'Returns & Exchanges',
      faq: 'FAQ',
      contactInfo: 'Contact Info',
      copyright: '© 2024 Jiffoo Mall. All rights reserved.',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      cookiePolicy: 'Cookie Policy',
    },
    'zh-CN': {
      description: '采用尖端技术构建的现代电商平台。快速、安全、美观的购物体验。',
      quickLinks: '快速链接',
      allProducts: '所有商品',
      categories: '分类',
      specialDeals: '特价优惠',
      newArrivals: '新品上架',
      bestSellers: '热销商品',
      customerService: '客户服务',
      helpCenter: '帮助中心',
      contactUs: '联系我们',
      shippingInfo: '配送信息',
      returnsExchanges: '退换货',
      faq: '常见问题',
      contactInfo: '联系信息',
      copyright: '© 2024 Jiffoo 商城。保留所有权利。',
      privacyPolicy: '隐私政策',
      termsOfService: '服务条款',
      cookiePolicy: 'Cookie 政策',
    },
    'ja-JP': {
      description: '最先端技術で構築された現代的なeコマースプラットフォーム。高速、安全、美しいショッピング体験。',
      quickLinks: 'クイックリンク',
      allProducts: 'すべての商品',
      categories: 'カテゴリー',
      specialDeals: '特別セール',
      newArrivals: '新着商品',
      bestSellers: 'ベストセラー',
      customerService: 'カスタマーサービス',
      helpCenter: 'ヘルプセンター',
      contactUs: 'お問い合わせ',
      shippingInfo: '配送情報',
      returnsExchanges: '返品・交換',
      faq: 'よくある質問',
      contactInfo: '連絡先情報',
      copyright: '© 2024 Jiffoo Mall. 全著作権所有。',
      privacyPolicy: 'プライバシーポリシー',
      termsOfService: '利用規約',
      cookiePolicy: 'Cookieポリシー',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">J</span>
              </div>
              <span className="font-bold text-xl text-gradient">Jiffoo</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('description')}
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Github className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold">{t('quickLinks')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="text-muted-foreground hover:text-foreground">
                  {t('allProducts')}
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-muted-foreground hover:text-foreground">
                  {t('categories')}
                </Link>
              </li>
              <li>
                <Link href="/deals" className="text-muted-foreground hover:text-foreground">
                  {t('specialDeals')}
                </Link>
              </li>
              <li>
                <Link href="/new-arrivals" className="text-muted-foreground hover:text-foreground">
                  {t('newArrivals')}
                </Link>
              </li>
              <li>
                <Link href="/bestsellers" className="text-muted-foreground hover:text-foreground">
                  {t('bestSellers')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h3 className="font-semibold">{t('customerService')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/help" className="text-muted-foreground hover:text-foreground">
                  {t('helpCenter')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                  {t('contactUs')}
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-muted-foreground hover:text-foreground">
                  {t('shippingInfo')}
                </Link>
              </li>
              <li>
                <Link href="/returns" className="text-muted-foreground hover:text-foreground">
                  {t('returnsExchanges')}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-muted-foreground hover:text-foreground">
                  {t('faq')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">{t('contactInfo')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">support@jiffoo.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  123 Commerce St, Tech City, TC 12345
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {t('copyright')}
          </div>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              {t('privacyPolicy')}
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              {t('termsOfService')}
            </Link>
            <Link href="/cookies" className="text-sm text-muted-foreground hover:text-foreground">
              {t('cookiePolicy')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

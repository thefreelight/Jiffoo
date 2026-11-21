import './tokens.css';
import type { ThemePackage } from 'shared/src/types/theme';

// 商店合约要求的 20 个组件里，与游戏门户无关的页面从 default 主题借桩
// （bokmoo/esim 先例：boring pages 由 default 提供，运行时按 slug+version 断言）。
import { NotFound } from '@shop-themes/default/src/components/NotFound';
import { OrderCancelledPage } from '@shop-themes/default/src/components/OrderCancelledPage';
import { ProfilePage } from '@shop-themes/default/src/components/ProfilePage';
import { ProductsPage } from '@shop-themes/default/src/components/ProductsPage';
import { ProductDetailPage } from '@shop-themes/default/src/components/ProductDetailPage';
import { CartPage } from '@shop-themes/default/src/components/CartPage';
import { CheckoutPage } from '@shop-themes/default/src/components/CheckoutPage';
import { OrdersPage } from '@shop-themes/default/src/components/OrdersPage';
import { OrderDetailPage } from '@shop-themes/default/src/components/OrderDetailPage';
import { OrderSuccessPage } from '@shop-themes/default/src/components/OrderSuccessPage';
import { ContactPage } from '@shop-themes/default/src/components/ContactPage';
import { HelpPage } from '@shop-themes/default/src/components/HelpPage';
import { PrivacyPage } from '@shop-themes/default/src/components/PrivacyPage';
import { TermsPage } from '@shop-themes/default/src/components/TermsPage';
import { LoginPage } from '@shop-themes/default/src/components/LoginPage';
import { RegisterPage } from '@shop-themes/default/src/components/RegisterPage';
import { AuthCallbackPage } from '@shop-themes/default/src/components/AuthCallbackPage';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { GamesPage } from './components/GamesPage';
import { GameDetailPage } from './components/GameDetailPage';

export const theme: ThemePackage = {
  components: {
    // 游戏门户真实页面
    HomePage,
    GamesPage,
    GameDetailPage,
    Header,
    Footer,
    // 商店合约组件：由 default 主题提供桩页（门户 UI 不链接这些路由）
    ProductsPage,
    ProductDetailPage,
    CartPage,
    CheckoutPage,
    NotFound,
    OrdersPage,
    OrderDetailPage,
    OrderSuccessPage,
    OrderCancelledPage,
    ProfilePage,
    ContactPage,
    HelpPage,
    PrivacyPage,
    TermsPage,
    LoginPage,
    RegisterPage,
    AuthCallbackPage,
  },
  defaultConfig: {
    brand: {
      name: 'PLAYGROUND',
      primaryColor: '#7c5cff',
      secondaryColor: '#0b0b13',
      fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, sans-serif',
    },
    layout: {
      headerSticky: true,
      showFooterLinks: true,
      maxWidth: '1280px',
    },
    features: {
      showWishlist: false,
      showRatings: false,
      enableQuickView: false,
    },
    site: {
      archetype: 'storefront',
      eyebrow: 'PLAYGROUND',
      headline: '免费网页游戏大厅',
      subheadline: '解谜、街机、休闲游戏即点即玩，无需下载注册。',
      primaryCtaLabel: '开始游戏',
      primaryCtaHref: '/games',
      secondaryCtaLabel: '小编精选',
      secondaryCtaHref: '/games?category=puzzle',
      supportEmail: 'support@jiffoo.com',
    },
  },
};

export default theme;

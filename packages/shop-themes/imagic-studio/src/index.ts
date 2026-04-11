import type { ThemePackage } from 'shared/src/types/theme';

import './tokens.css';

import { AuthCallbackPage } from '@shop-themes/default/src/components/AuthCallbackPage';
import { CartPage } from '@shop-themes/default/src/components/CartPage';
import { CheckoutPage } from '@shop-themes/default/src/components/CheckoutPage';
import { ContactPage } from '@shop-themes/default/src/components/ContactPage';
import { HelpPage } from '@shop-themes/default/src/components/HelpPage';
import { LoginPage } from '@shop-themes/default/src/components/LoginPage';
import { NotFound } from '@shop-themes/default/src/components/NotFound';
import { OrderCancelledPage } from '@shop-themes/default/src/components/OrderCancelledPage';
import { OrderDetailPage } from '@shop-themes/default/src/components/OrderDetailPage';
import { OrdersPage } from '@shop-themes/default/src/components/OrdersPage';
import { OrderSuccessPage } from '@shop-themes/default/src/components/OrderSuccessPage';
import { PrivacyPage } from '@shop-themes/default/src/components/PrivacyPage';
import { ProductDetailPage } from '@shop-themes/default/src/components/ProductDetailPage';
import { ProductsPage } from '@shop-themes/default/src/components/ProductsPage';
import { ProfilePage } from '@shop-themes/default/src/components/ProfilePage';
import { RegisterPage } from '@shop-themes/default/src/components/RegisterPage';
import { TermsPage } from '@shop-themes/default/src/components/TermsPage';
import { Toast, ToastContainer } from '@shop-themes/default/src/ui/Toast';
import type { ToastProps, ToastType } from '@shop-themes/default/src/ui/Toast';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';

export { Toast, ToastContainer };
export type { ToastProps, ToastType };

export const theme: ThemePackage = {
  components: {
    HomePage,
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
    Header,
    Footer,
  },
  defaultConfig: {
    brand: {
      name: 'Imagic',
      primaryColor: '#2457f5',
      secondaryColor: '#f97316',
      fontFamily: '"Space Grotesk", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
    layout: {
      headerSticky: true,
      showFooterLinks: true,
      maxWidth: '1320px',
    },
    features: {
      showWishlist: false,
      showRatings: false,
      enableQuickView: false,
    },
    site: {
      archetype: 'product-site',
      eyebrow: 'Creator-grade AI film lab',
      headline: 'Turn stills and short clips into painterly worlds that feel ready to publish.',
      subheadline:
        'Rebuilt for imagic.art with a cleaner image pipeline, async video transformation, and a more cinematic storefront surface.',
      primaryCtaLabel: 'Start Creating',
      primaryCtaHref: '/',
      secondaryCtaLabel: 'How It Works',
      secondaryCtaHref: '/help',
      docsHref: '/help',
      demoHref: '/',
      supportEmail: 'support@imagic.art',
    },
  },
};

export default theme;

import type { ThemePackage } from 'shared/src/types/theme';

import './tokens.css';

import { NotFound } from '@shop-themes/default/src/components/NotFound';
import { OrderCancelledPage } from '@shop-themes/default/src/components/OrderCancelledPage';
import { ProfilePage } from '@shop-themes/default/src/components/ProfilePage';
import { Toast, ToastContainer } from '@shop-themes/default/src/ui/Toast';
import type { ToastProps, ToastType } from '@shop-themes/default/src/ui/Toast';

import { AuthCallbackPage } from './components/AuthCallbackPage';
import { CartPage } from './components/CartPage';
import { CategoriesPage } from './components/CategoriesPage';
import { CheckoutPage } from './components/CheckoutPage';
import { BestsellersPage, DealsPage, NewArrivalsPage, SearchPage } from './components/CollectionPages';
import { ContactPage } from './components/ContactPage';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HelpPage } from './components/HelpPage';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrdersPage } from './components/OrdersPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { PrivacyPage } from './components/PrivacyPage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
import { RegisterPage } from './components/RegisterPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { ProductsPage } from './components/ProductsPage';
import { TermsPage } from './components/TermsPage';

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
    BestsellersPage,
    NewArrivalsPage,
    CategoriesPage,
    SearchPage,
    OrdersPage,
    OrderDetailPage,
    OrderSuccessPage,
    OrderCancelledPage,
    ProfilePage,
    ProfileSettingsPage,
    ContactPage,
    HelpPage,
    PrivacyPage,
    TermsPage,
    DealsPage,
    LoginPage,
    RegisterPage,
    AuthCallbackPage,
    Header,
    Footer,
  },
  defaultConfig: {
    brand: {
      name: 'BOKMOO',
      primaryColor: '#d7b23d',
      secondaryColor: '#11100d',
      fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif',
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
      eyebrow: 'BOKMOO eSIM Card',
      headline: 'One Card.\nGlobal Connection.',
      subheadline:
        'Use multiple eSIM profiles on your BOKMOO card. Stay connected in 200+ countries.',
      primaryCtaLabel: 'Shop eSIM Plans',
      primaryCtaHref: '/products',
      secondaryCtaLabel: 'How it works',
      secondaryCtaHref: '/#how-it-works',
      demoHref: '/products',
      docsHref: '/help',
      supportEmail: 'support@bokmoo.com',
    },
  },
};

export default theme;

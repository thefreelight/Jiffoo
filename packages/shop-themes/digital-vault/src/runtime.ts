import type { ThemePackage } from 'shared/src/types/theme';

import { AuthCallbackPage } from '@shop-themes/default/src/components/AuthCallbackPage';
import { CartPage } from '@shop-themes/default/src/components/CartPage';
import { ContactPage } from '@shop-themes/default/src/components/ContactPage';
import { HelpPage } from '@shop-themes/default/src/components/HelpPage';
import { LoginPage } from '@shop-themes/default/src/components/LoginPage';
import { NotFound } from '@shop-themes/default/src/components/NotFound';
import { OrderCancelledPage } from '@shop-themes/default/src/components/OrderCancelledPage';
import { PrivacyPage } from '@shop-themes/default/src/components/PrivacyPage';
import { ProfilePage } from '@shop-themes/default/src/components/ProfilePage';
import { RegisterPage } from '@shop-themes/default/src/components/RegisterPage';
import { TermsPage } from '@shop-themes/default/src/components/TermsPage';

import { CategoriesPage } from './components/CategoriesPage';
import { CheckoutPage } from './components/CheckoutPage';
import { BestsellersPage, DealsPage, NewArrivalsPage, SearchPage } from './components/CollectionPages';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrdersPage } from './components/OrdersPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { ProductsPage } from './components/ProductsPage';

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
      name: 'Digital Vault',
      primaryColor: '#3563f6',
      secondaryColor: '#0f2942',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
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
      eyebrow: 'Instant digital delivery storefront',
      headline:
        'Sell gift cards, keys, accounts, and downloads with delivery built in.',
      subheadline:
        'Set delivery expectations before payment, keep every result inside the order locker, and leave manual fallback ready for the ops team.',
      primaryCtaLabel: 'Browse digital goods',
      primaryCtaHref: '/products',
      secondaryCtaLabel: 'How delivery works',
      secondaryCtaHref: '/help',
      demoHref: '/products',
      docsHref: '/help',
      supportEmail: 'support@example.com',
    },
  },
};

export default theme;

import type { ThemePackage } from 'shared/src/types/theme';

import { AuthCallbackPage } from '@shop-themes/default/src/components/AuthCallbackPage';
import { ContactPage } from '@shop-themes/default/src/components/ContactPage';
import { HelpPage } from '@shop-themes/default/src/components/HelpPage';
import { LoginPage } from '@shop-themes/default/src/components/LoginPage';
import { NotFound } from '@shop-themes/default/src/components/NotFound';
import { OrderCancelledPage } from '@shop-themes/default/src/components/OrderCancelledPage';
import { PrivacyPage } from '@shop-themes/default/src/components/PrivacyPage';
import { ProfilePage } from '@shop-themes/default/src/components/ProfilePage';
import { RegisterPage } from '@shop-themes/default/src/components/RegisterPage';
import { TermsPage } from '@shop-themes/default/src/components/TermsPage';

import { CartPage } from './components/CartPage';
import { CategoriesPage } from './components/CategoriesPage';
import { CheckoutPage } from './components/CheckoutPage';
import { BestsellersPage, DealsPage, NewArrivalsPage, SearchPage } from './components/CollectionPages';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrdersPage } from './components/OrdersPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
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
      name: 'Bokmoo',
      primaryColor: '#c9a85f',
      secondaryColor: '#1f1d19',
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
      eyebrow: 'Premium global connectivity',
      headline:
        'Travel connectivity, packaged with the calm precision of a premium welcome kit.',
      subheadline:
        'Bokmoo pairs instant QR delivery with a restrained black-and-gold storefront so every destination plan feels considered before departure.',
      primaryCtaLabel: 'Browse eSIM plans',
      primaryCtaHref: '/products',
      secondaryCtaLabel: 'Check device support',
      secondaryCtaHref: '/help',
      demoHref: '/products',
      docsHref: '/help',
      supportEmail: 'support@bokmoo.com',
    },
  },
};

export default theme;

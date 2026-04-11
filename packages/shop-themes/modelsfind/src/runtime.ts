import type { ThemePackage } from 'shared/src/types/theme';

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
import { ProfilePage } from '@shop-themes/default/src/components/ProfilePage';
import { RegisterPage } from '@shop-themes/default/src/components/RegisterPage';
import { TermsPage } from '@shop-themes/default/src/components/TermsPage';

import { CategoriesPage } from './components/CategoriesPage';
import { BestsellersPage, DealsPage, NewArrivalsPage, SearchPage } from './components/CollectionPages';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
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
      name: 'modelsfind',
      primaryColor: '#d25ad3',
      secondaryColor: '#f4b5ea',
      fontFamily: '"Cormorant Garamond", "Iowan Old Style", serif',
    },
    layout: {
      headerSticky: true,
      showFooterLinks: true,
      maxWidth: '1320px',
    },
    features: {
      showWishlist: true,
      showRatings: false,
      enableQuickView: false,
    },
    site: {
      archetype: 'product-site',
      eyebrow: 'Curated model directory',
      headline: 'Editorial model profiles, instant availability cues, and premium booking requests in one refined destination.',
      subheadline:
        'Built for operators presenting premium model portfolios. Filter by region, look, and access tier while keeping the storefront polished, discreet, and booking-ready.',
      primaryCtaLabel: 'Explore collection',
      primaryCtaHref: '/products',
      secondaryCtaLabel: 'Request access',
      secondaryCtaHref: '/auth/register',
      docsHref: '/help',
      demoHref: '/products',
      supportEmail: 'hello@modelsfind.com',
    },
  },
};

export default theme;

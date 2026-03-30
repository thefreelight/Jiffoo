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
import { CheckoutPage } from '@shop-themes/digital-vault/src/components/CheckoutPage';
import { OrderDetailPage } from '@shop-themes/digital-vault/src/components/OrderDetailPage';
import { OrdersPage } from '@shop-themes/digital-vault/src/components/OrdersPage';
import { OrderSuccessPage } from '@shop-themes/digital-vault/src/components/OrderSuccessPage';
import { ProductDetailPage } from '@shop-themes/digital-vault/src/components/ProductDetailPage';

import { CategoriesPage } from './components/CategoriesPage';
import { BestsellersPage, DealsPage, NewArrivalsPage, SearchPage } from './components/CollectionPages';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
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
      name: 'NavToAI',
      primaryColor: '#2f62f5',
      secondaryColor: '#15346d',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    },
    layout: {
      headerSticky: true,
      showFooterLinks: true,
      maxWidth: '1280px',
    },
    features: {
      showWishlist: false,
      showRatings: true,
      enableQuickView: false,
    },
    site: {
      archetype: 'product-site',
      eyebrow: 'Curated AI stack directory',
      headline: 'Find the AI tools that fit the workflow, not just the launch cycle.',
      subheadline:
        'NavToAI gives AI catalogs a calmer navigation-site structure with sharper categories, clearer signals, and storefront flows that still convert when a tool belongs in the stack.',
      primaryCtaLabel: 'Browse the directory',
      primaryCtaHref: '/products',
      secondaryCtaLabel: 'Open buyer guide',
      secondaryCtaHref: '/help',
      docsHref: '/help',
      demoHref: '/products',
      supportEmail: 'hello@navto.ai',
    },
  },
};

export default theme;

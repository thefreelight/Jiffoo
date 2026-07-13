import type { ThemePackage } from './types/theme';

import './tokens.css';

import { AuthCallbackPage } from './components/AuthCallbackPage';
import { CategoriesPage } from './components/CategoriesPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { BestsellersPage, DealsPage, NewArrivalsPage, SearchPage } from './components/CollectionPages';
import { ContactPage } from './components/ContactPage';
import { Footer } from './components/Footer';
import { GuestOrderLookupPage } from './components/GuestOrderLookupPage';
import { Header } from './components/Header';
import { HelpPage } from './components/HelpPage';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { NotFound } from './components/NotFound';
import { OrderCancelledPage } from './components/OrderCancelledPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrdersPage } from './components/OrdersPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { PrivacyPage } from './components/PrivacyPage';
import { ProfilePage } from './components/ProfilePage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { ProductsPage } from './components/ProductsPage';
import { RegisterPage } from './components/RegisterPage';
import { TermsPage } from './components/TermsPage';
import { Toast, ToastContainer } from './ui/Toast';
import type { ToastProps, ToastType } from './ui/Toast';

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
    GuestOrderLookupPage,
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
      eyebrow: 'Instant digital goods storefront',
      headline:
        'Sell card codes, accounts, and downloads with a storefront built for delivery.',
      subheadline:
        'Browse by category, confirm stock before payment, and keep every delivery inside the order center instead of losing it in support chat.',
      primaryCtaLabel: 'Browse products',
      primaryCtaHref: '/products',
      secondaryCtaLabel: 'Help center',
      secondaryCtaHref: '/help',
      demoHref: '/products',
      docsHref: '/help',
      supportEmail: 'support@example.com',
    },
  },
};

export default theme;

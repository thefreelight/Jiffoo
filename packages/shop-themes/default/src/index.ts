/**
 * Default theme package entry point
 * Export ThemePackage interface implementation
 */

import './tokens.css';
import type { ThemePackage } from 'shared/src/types/theme';

// Import page components
import { HomePage } from './components/HomePage';
import { ProductsPage } from './components/ProductsPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { NotFound } from './components/NotFound';
// Order related pages
import { OrdersPage } from './components/OrdersPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { OrderCancelledPage } from './components/OrderCancelledPage';
// User center pages
import { ProfilePage } from './components/ProfilePage';
// Content pages
import { ContactPage } from './components/ContactPage';
import { HelpPage } from './components/HelpPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
// Auth pages
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { AuthCallbackPage } from './components/AuthCallbackPage';
// Layout components
import { Header } from './components/Header';
import { Footer } from './components/Footer';

// UI component exports
export { Toast, ToastContainer } from './ui/Toast';
export type { ToastProps, ToastType } from './ui/Toast';

/**
 * Default theme package
 */
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
      primaryColor: '#2563eb',
      secondaryColor: '#7c3aed',
    },
    layout: {
      headerSticky: true,
      showFooterLinks: true,
      maxWidth: '1280px',
    },
    features: {
      showWishlist: true,
      showRatings: true,
      enableQuickView: false,
    },
  },
};

export default theme;

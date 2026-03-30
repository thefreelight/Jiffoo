/**
 * eSIM Mall Theme - Entry Point
 * Export ThemePackage interface implementation
 */

import './tokens.css';
import type { ThemePackage } from 'shared';

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
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
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
// Optional pages
import { BestsellersPage } from './components/BestsellersPage';
import { NewArrivalsPage } from './components/NewArrivalsPage';
import { CategoriesPage } from './components/CategoriesPage';
import { SearchPage } from './components/SearchPage';
import { DealsPage } from './components/DealsPage';

// UI component exports
export { Toast, ToastContainer } from './ui/Toast';
export type { ToastProps, ToastType } from './ui/Toast';

/**
 * eSIM Mall theme package
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
    ProfileSettingsPage,
    ContactPage,
    HelpPage,
    PrivacyPage,
    TermsPage,
    LoginPage,
    RegisterPage,
    AuthCallbackPage,
    Header,
    Footer,
    BestsellersPage,
    NewArrivalsPage,
    CategoriesPage,
    SearchPage,
    DealsPage,
  },
  defaultConfig: {
    brand: {
      primaryColor: '#2563eb',
      secondaryColor: '#06b6d4',
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
  },
};

export default theme;

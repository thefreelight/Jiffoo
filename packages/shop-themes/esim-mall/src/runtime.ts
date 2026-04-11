import type { ThemePackage } from 'shared';

import { HomePage } from './components/HomePage';
import { ProductsPage } from './components/ProductsPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { NotFound } from './components/NotFound';
import { OrdersPage } from './components/OrdersPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { OrderCancelledPage } from './components/OrderCancelledPage';
import { ProfilePage } from './components/ProfilePage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
import { ContactPage } from './components/ContactPage';
import { HelpPage } from './components/HelpPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { AuthCallbackPage } from './components/AuthCallbackPage';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BestsellersPage } from './components/BestsellersPage';
import { NewArrivalsPage } from './components/NewArrivalsPage';
import { CategoriesPage } from './components/CategoriesPage';
import { SearchPage } from './components/SearchPage';
import { DealsPage } from './components/DealsPage';

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

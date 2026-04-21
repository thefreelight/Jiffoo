import type { ThemePackage } from 'shared/src/types/theme';

import './tokens.css';

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
import { NotFound } from './components/NotFound';
import { OrderCancelledPage } from './components/OrderCancelledPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrdersPage } from './components/OrdersPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { PrivacyPage } from './components/PrivacyPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { ProductsPage } from './components/ProductsPage';
import { ProfilePage } from './components/ProfilePage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
import { RegisterPage } from './components/RegisterPage';
import { TermsPage } from './components/TermsPage';
import { defaultModelsfindThemeConfig } from './site';

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
  defaultConfig: defaultModelsfindThemeConfig,
};

export default theme;

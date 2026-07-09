import type { ThemePackage } from './types/theme';

import { AuthCallbackPage } from './components/AuthCallbackPage';
import { BestsellersPage } from './components/BestsellersPage';
import { CartPage } from './components/CartPage';
import { CategoriesPage } from './components/CategoriesPage';
import { CheckoutPage } from './components/CheckoutPage';
import { ContactPage } from './components/ContactPage';
import { DealsPage } from './components/DealsPage';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HelpPage } from './components/HelpPage';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { NewArrivalsPage } from './components/NewArrivalsPage';
import { NotFound } from './components/NotFound';
import { OrderCancelledPage } from './components/OrderCancelledPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { OrdersPage } from './components/OrdersPage';
import { PrivacyPage } from './components/PrivacyPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { ProductsPage } from './components/ProductsPage';
import { ProfilePage } from './components/ProfilePage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
import { RegisterPage } from './components/RegisterPage';
import { SearchPage } from './components/SearchPage';
import { TermsPage } from './components/TermsPage';

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
      name: 'EASYEUICC',
      primaryColor: '#176bff',
      secondaryColor: '#0b4edb',
      fontFamily: '"Manrope", "Aptos", sans-serif',
    },
    layout: {
      headerSticky: true,
      showFooterLinks: true,
      maxWidth: '1180px',
    },
    features: {
      showWishlist: false,
      showRatings: false,
      enableQuickView: false,
    },
    site: {
      archetype: 'app-download',
      eyebrow: 'EasyEUICC for Android',
      headline: 'Download EasyEUICC',
      subheadline: 'A focused Android eUICC manager for installing, switching, and maintaining your eSIM profiles.',
      primaryCtaLabel: 'Download APK',
      primaryCtaHref: 'https://easyeuicc.cc/downloads/EasyEUICC-v1.6.2.apk',
      supportEmail: 'support@easyeuicc.cc',
      appVersion: 'v1.6.2-unpriv',
      androidDownloadUrl: 'https://easyeuicc.cc/downloads/EasyEUICC-v1.6.2.apk',
      downloadChecksum: 'e1c5b71b08fa9c7aef036cf106f59fe7c49075131009ffaf8f97046896af63fc',
      downloadQrUrl: '/easyeuicc-download-qr.png',
      appScreenshotUrl: '/easyeuicc-real-empty.png',
    },
  },
};

export default theme;

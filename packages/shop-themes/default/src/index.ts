/**
 * 默认主题包入口
 * 导出 ThemePackage 接口实现
 */

import './tokens.css';
import type { ThemePackage } from 'shared/src/types/theme';

// 导入页面组件
import { HomePage } from './components/HomePage';
import { ProductsPage } from './components/ProductsPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { NotFound } from './components/NotFound';
// 商品列表变体页面
import { BestsellersPage } from './components/BestsellersPage';
import { NewArrivalsPage } from './components/NewArrivalsPage';
import { CategoriesPage } from './components/CategoriesPage';
import { SearchPage } from './components/SearchPage';
// 订单相关页面
import { OrdersPage } from './components/OrdersPage';
import { OrderDetailPage } from './components/OrderDetailPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { OrderCancelledPage } from './components/OrderCancelledPage';
// 用户中心页面
import { ProfilePage } from './components/ProfilePage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
// 内容页面
import { ContactPage } from './components/ContactPage';
import { HelpPage } from './components/HelpPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
// 特殊页面
import { DealsPage } from './components/DealsPage';
import { AffiliateDashboardPage } from './components/AffiliateDashboardPage';
// Auth 页面
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { AuthCallbackPage } from './components/AuthCallbackPage';
// 布局组件
import { Header } from './components/Header';
import { Footer } from './components/Footer';

// UI 组件导出
export { Toast, ToastContainer } from './ui/Toast';
export type { ToastProps, ToastType } from './ui/Toast';

/**
 * 默认主题包
 */
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
    AffiliateDashboardPage,
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

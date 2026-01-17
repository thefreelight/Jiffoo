/**
 * TravelPass Theme for Jiffoo Mall
 * 
 * SDK-compliant theme package with all required components.
 * Each component accepts proper Props interfaces from shared/src/types/theme.
 */

import type { ThemePackage } from '../../../shared/src/types/theme';

// Layout Components
import { Header } from './components/layout/header';
import { Footer } from './components/layout/footer';
import { NotFound } from './components/NotFound';

// Core Page Components
import { HomePage } from './pages/home-page';
import { ProductsPage } from './pages/products-page';
import { CartPage } from './pages/cart-page';

// Additional Page Components
import {
    CheckoutPage,
    CategoriesPage,
    OrdersPage,
    OrderDetailPage,
    OrderSuccessPage,
    OrderCancelledPage,
    ProfilePage,
    ProfileSettingsPage,
    HelpPage,
    ContactPage,
    PrivacyPage,
    TermsPage,
    AffiliateDashboardPage,
    LoginPage,
    RegisterPage,
    AuthCallbackPage,
    ProductDetailPage,
    BestsellersPage,
    NewArrivalsPage,
    DealsPage,
    SearchPage,
} from './pages/additional-pages';

/**
 * TravelPass Theme Package
 * Complete SDK-compliant theme with TravelPass eSIM travel design
 */
export const theme: ThemePackage = {
    components: {
        // Required page components
        HomePage,
        ProductsPage,
        ProductDetailPage,
        CartPage,
        CheckoutPage,
        NotFound,

        // Product listing variants
        BestsellersPage,
        NewArrivalsPage,
        CategoriesPage,
        SearchPage,

        // Order pages
        OrdersPage,
        OrderDetailPage,
        OrderSuccessPage,
        OrderCancelledPage,

        // User pages
        ProfilePage,
        ProfileSettingsPage,

        // Content pages
        ContactPage,
        HelpPage,
        PrivacyPage,
        TermsPage,

        // Special pages
        DealsPage,
        AffiliateDashboardPage,

        // Auth pages
        LoginPage,
        RegisterPage,
        AuthCallbackPage,

        // Layout
        Header,
        Footer,
    },

    defaultConfig: {
        brand: {
            primaryColor: '#2563eb', // Blue-600
            secondaryColor: '#06b6d4', // Cyan-500
            name: 'TravelPass',
        },
        layout: {
            headerSticky: false, // TravelPass uses transparent header
            showFooterLinks: true,
            maxWidth: '1280px',
        },
        features: {
            showWishlist: false,
            showRatings: true,
            enableQuickView: false,
        },
    },
};

export default theme;

// Named exports for individual components (for advanced usage)
export {
    Header,
    Footer,
    HomePage,
    ProductsPage,
    CartPage,
    NotFound,
};

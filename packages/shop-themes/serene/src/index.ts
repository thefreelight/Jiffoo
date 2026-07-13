/**
 * Serene theme package entry point
 *
 * A calm, indigo-accented built-in theme. It ships its own HomePage design
 * and reuses the remaining page components from the default built-in theme,
 * so both themes stay functionally identical outside the landing page.
 */

import './tokens.css';
import type { ThemePackage } from 'shared/src/types/theme';
import defaultTheme from '@shop-themes/default';

import { HomePage } from './components/HomePage';

export const theme: ThemePackage = {
  components: {
    ...defaultTheme.components,
    HomePage,
  },
  defaultConfig: {
    brand: {
      primaryColor: '#4f46e5',
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

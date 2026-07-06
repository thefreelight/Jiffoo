import React from 'react';
import type { HomePageProps } from '../../../../shared/src/types/theme';
import { resolveSiteConfig } from '../site';
import { HomePage as ProductSiteHomePage } from './HomePage';
import { StorefrontHomePage } from './StorefrontHomePage';

export const HomePage = React.memo(function AdaptiveHomePage(props: HomePageProps) {
  const site = resolveSiteConfig(props.config);

  if (site.archetype === 'storefront') {
    return <StorefrontHomePage {...props} />;
  }

  return <ProductSiteHomePage {...props} />;
});

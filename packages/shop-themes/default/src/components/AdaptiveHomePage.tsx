import React from 'react';
import type { HomePageProps } from '../../../../shared/src/types/theme';
import { StorefrontHomePage } from './StorefrontHomePage';

export const HomePage = React.memo(function AdaptiveHomePage(props: HomePageProps) {
  return <StorefrontHomePage {...props} />;
});

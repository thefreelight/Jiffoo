import type { HomePageProps } from 'shared/src/types/theme';

import { StudioHomeClient } from './StudioHomeClient';

export function HomePage(props: HomePageProps) {
  return <StudioHomeClient {...props} />;
}

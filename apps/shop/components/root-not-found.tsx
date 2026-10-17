import { shopBootstrap } from '@/lib/server-bootstrap';
import { ThemeShell } from './locale-layout';
import { NotFoundContent } from './not-found-content';

export default async function RootNotFound() {
  const { context, theme, locale, navigation, profile, cart } = await shopBootstrap();
  return <ThemeShell context={context} locale={locale} navigation={navigation} theme={theme}
    loggedIn={!!profile} cartCount={cart?.itemCount ?? 0} initialCart={cart}>
    <NotFoundContent locale={locale} />
  </ThemeShell>;
}

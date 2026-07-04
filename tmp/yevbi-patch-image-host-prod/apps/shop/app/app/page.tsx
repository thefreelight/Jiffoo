/**
 * Root Page - Redirect to Default Locale
 *
 * This page exists as a fallback. Normally, the middleware should handle
 * the redirect to /{locale}/, but this provides a fallback in case
 * the middleware doesn't catch the request.
 */

import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from 'shared/src/i18n';

export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
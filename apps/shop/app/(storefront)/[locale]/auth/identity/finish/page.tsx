import { SocialFinish } from '@/components/social-finish';
import { requireLocale } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function IdentityFinishPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await requireLocale((await params).locale);
  const query = await searchParams;
  return <SocialFinish locale={locale} {...(query.error ? { error: query.error } : {})} />;
}

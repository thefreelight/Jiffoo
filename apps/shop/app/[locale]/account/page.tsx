import { redirect } from 'next/navigation';
import { AccountManagement } from '@/components/account-management';
import { getStoreContext, messages, requireLocale } from '@/lib/catalog';
import { accountProfile } from '@/lib/server-account';

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await requireLocale((await params).locale);
  const profile = await accountProfile();
  if (!profile) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);
  const context = await getStoreContext();
  return <AccountManagement locale={locale} profile={profile} locales={context.supportedLocales} labels={messages(locale).account} />;
}

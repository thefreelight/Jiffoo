import { AuthForm } from '@/components/auth-form';
import { messages, requireLocale } from '@/lib/catalog';
import { safeNextPath } from '@/lib/auth-contract';

export default async function RegisterPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await requireLocale((await params).locale);
  return <AuthForm mode="register" locale={locale} labels={messages(locale).account}
    next={safeNextPath((await searchParams).next, locale)} />;
}

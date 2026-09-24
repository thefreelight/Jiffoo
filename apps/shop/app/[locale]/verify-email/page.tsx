import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { VerifyEmailAction } from '@/components/verify-email-action';
import { messages, requireLocale } from '@/lib/catalog';

export default async function VerifyEmailPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await requireLocale((await params).locale);
  const { token } = await searchParams;
  const t = messages(locale).account;
  if (!token) return <AuthForm mode="verify-email" locale={locale} labels={t} next={`/${locale}/account`} />;
  return <main className="mx-auto max-w-md px-4 py-12">
    <h1 className="text-2xl font-semibold">{t.verify}</h1>
    <VerifyEmailAction token={token} labels={t} />
    <Link className="mt-6 block text-action" href={`/${locale}/account`}>{t.back}</Link>
  </main>;
}

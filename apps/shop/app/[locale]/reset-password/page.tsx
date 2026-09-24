import { AuthForm } from '@/components/auth-form';
import { messages, requireLocale } from '@/lib/catalog';

export default async function ResetPasswordPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await requireLocale((await params).locale);
  const { token } = await searchParams;
  return token
    ? <AuthForm mode="reset-password" locale={locale} labels={messages(locale).account} next={`/${locale}`} token={token} />
    : <main className="mx-auto max-w-md px-4 py-12"><h1 className="text-2xl font-semibold">{messages(locale).account.reset}</h1><p>{messages(locale).account.verificationFailed}</p></main>;
}

import { AuthForm } from '@/components/auth-form';
import { messages, requireLocale } from '@/lib/catalog';

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await requireLocale((await params).locale);
  return <AuthForm mode="forgot-password" locale={locale} labels={messages(locale).account} next={`/${locale}`} />;
}

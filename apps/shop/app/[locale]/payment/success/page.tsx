import { redirect } from 'next/navigation';
import {
  buildPaymentResultRedirect,
  type PaymentResultSearchParams,
} from '@/lib/payment-result-redirect';

interface PaymentSuccessPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<PaymentResultSearchParams>;
}

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: PaymentSuccessPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  redirect(buildPaymentResultRedirect(locale, 'order-success', query));
}

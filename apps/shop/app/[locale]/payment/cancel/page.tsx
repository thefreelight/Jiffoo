import { redirect } from 'next/navigation';
import {
  buildPaymentResultRedirect,
  type PaymentResultSearchParams,
} from '@/lib/payment-result-redirect';

interface PaymentCancelPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<PaymentResultSearchParams>;
}

export default async function PaymentCancelPage({
  params,
  searchParams,
}: PaymentCancelPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  redirect(buildPaymentResultRedirect(locale, 'order-cancelled', query));
}

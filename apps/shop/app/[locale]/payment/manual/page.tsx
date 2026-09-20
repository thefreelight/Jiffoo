import type { Metadata } from 'next';

interface ManualPaymentPageProps {
  searchParams: Promise<{ order_id?: string }>;
}

export const metadata: Metadata = {
  title: 'Manual payment',
  robots: { index: false, follow: false },
};

export default async function ManualPaymentPage({
  searchParams,
}: ManualPaymentPageProps) {
  const query = await searchParams;
  const orderReference = query.order_id || 'Unavailable';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <section className="w-full border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Manual payment instructions</h1>
        <p className="mt-4 text-slate-700">
          Your order is awaiting manual payment confirmation. Follow the payment instructions provided by the store, then keep this order reference for your records.
        </p>
        <dl className="mt-8 border-t border-slate-200 pt-5">
          <dt className="text-sm font-medium text-slate-500">Order reference</dt>
          <dd className="mt-1 break-all font-mono text-sm text-slate-900">{orderReference}</dd>
        </dl>
      </section>
    </main>
  );
}

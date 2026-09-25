import { notFound, redirect } from 'next/navigation';
import { requireLocale, messages } from '@/lib/catalog';
import { customerOrder } from '@/lib/server-checkout';
import { accountProfile } from '@/lib/server-account';

export default async function CancelPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await requireLocale((await params).locale);
  const id = (await searchParams).order;
  if (!id) notFound();
  if (!(await accountProfile())) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/checkout/cancel?order=${id}`)}`);
  const order = await customerOrder(id);
  if (!order) notFound();
  return <main className="mx-auto max-w-4xl px-4 py-10 md:px-8">
    <h1 className="text-2xl font-semibold">{messages(locale).checkout.pending}</h1>
    <p className="mt-4">{messages(locale).checkout.cancelled}</p>
  </main>;
}

import { redirect } from 'next/navigation';
import { productById, requireLocale } from '@/lib/catalog';
import { accountProfile } from '@/lib/server-account';
import { customerCart } from '@/lib/server-checkout';
import { CartView } from '@/components/cart-view';

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, context } = await requireLocale((await params).locale);
  if (!(await accountProfile())) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/cart`)}`);
  const cart = await customerCart();
  if (!cart) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/cart`)}`);
  const products = await Promise.all([...new Set(cart.items.map((line) => line.productId))].map(async (id) => [id, await productById(locale, id)] as const));
  const productLinks = Object.fromEntries(products.flatMap(([id, product]) => product ? [[id, `/${locale}/products/${encodeURIComponent(product.slug)}`]] : []));
  return <CartView initial={cart} locale={locale} currency={context.currency} productLinks={productLinks} />;
}

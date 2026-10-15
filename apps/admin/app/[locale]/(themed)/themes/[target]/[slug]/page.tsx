import { notFound } from 'next/navigation';
import { ThemeEditor } from '@/components/themes/ThemeEditor';

export default async function ThemeEditPage({ params }: { params: Promise<{ target: string; slug: string }> }) {
  const { target, slug } = await params;
  if (target !== 'shop' && target !== 'admin') notFound();
  return <ThemeEditor target={target} slug={slug} />;
}

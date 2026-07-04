'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { HomePage } from '../../components/HomePage';
import { easyEuiccPreviewConfig } from '../../lib/easyeuiccPreview';

export default function Home() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const preview = searchParams.get('preview');

  const handleNavigate = (path: string) => {
    router.push(`/${locale}${path}`);
  };

  return (
    <HomePage
      onNavigate={handleNavigate}
      config={preview === 'easyeuicc' ? easyEuiccPreviewConfig : undefined}
    />
  );
}

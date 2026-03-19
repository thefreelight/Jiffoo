'use client';

import { useParams } from 'next/navigation';
import { PluginWorkspace } from '@/components/plugins/PluginWorkspace';

export default function PluginAdminHostPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  return <PluginWorkspace slug={slug} />;
}

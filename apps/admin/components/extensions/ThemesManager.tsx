'use client';

import { useThemes, useActivateTheme } from '@/lib/hooks/use-api';
import { Button } from '@/components/ui/button';

export function ThemesManager({ target = 'shop' }: { target?: 'shop' | 'admin' }) {
  const { data } = useThemes(target);
  const activate = useActivateTheme();
  return <section>{(data?.items || []).map((theme) => <div key={theme.slug}><span>{theme.name}</span><Button onClick={() => activate.mutate({ slug: theme.slug, target, type: 'pack' })}>Activate</Button></div>)}</section>;
}

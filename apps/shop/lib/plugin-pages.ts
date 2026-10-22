import 'server-only';
import { shopApi } from './core-transport';
import type { PageDeclarations } from 'shared/src/plugin-pages/labels';

export async function storefrontPluginPages(): Promise<PageDeclarations> {
  const response = await shopApi('/plugin-pages');
  if (!response.ok) throw new Error('Plugin declarations unavailable');
  return (await response.json()).data as PageDeclarations;
}

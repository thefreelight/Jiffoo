// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { PluginRecovery } from '@/components/extensions/PluginRecovery';
import type { PluginRecoveryList } from '@/lib/plugin-upload';

let dictionary: typeof en | typeof hans | typeof hant = en;
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], dictionary) ?? key }));
function render(data?: PluginRecoveryList) {
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}}); if(data)client.setQueryData(['plugin-recovery'],data);
  const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(PluginRecovery)));client.clear();return html;
}
const operation={operationId:'persisted',slug:'example',version:'2.0.0',phase:'NEEDS_RECOVERY',committedPrefix:1,retryAvailable:true,publicationWarning:false};
it('N persistent recovery data renders on a fresh page without upload component state',()=>{
  dictionary=en;const data={items:[{slug:'example',markerCount:0,maintenanceRequired:false,operations:[operation]}]};
  for(let page=0;page<2;page++){const html=render(data);expect(html).toContain(en.plugins.recovery.needsRecovery);expect(html).toContain('2.0.0');expect(html).toContain(en.plugins.recovery.confirmRetry);expect(html).toContain('disabled');}
});
it.each([en,hans,hant])('N unconfirmed process work plainly requires a maintenance window in locale %#',locale=>{
  dictionary=locale;const html=render({items:[{slug:'example',markerCount:1,maintenanceRequired:true,operations:[operation]}]});
  expect(html).toContain(locale.plugins.recovery.maintenance);expect(html).not.toContain(locale.plugins.recovery.retry);expect(html).not.toContain('reclaim');
  expect(Object.keys(locale.plugins.recovery).sort()).toEqual(Object.keys(en.plugins.recovery).sort());for(const copy of Object.values(locale.plugins.recovery))expect(copy.trim()).not.toBe('');
});
it('N confirmed publication displays its lifecycle warning without offering replay',()=>{
  dictionary=en;const html=render({items:[{slug:'example',markerCount:0,maintenanceRequired:false,operations:[{...operation,phase:'SUCCESS',retryAvailable:false,publicationWarning:true}]}]});
  expect(html).toContain(en.plugins.recovery.completed);expect(html).toContain(en.plugins.recovery.publicationWarning);expect(html).not.toContain(en.plugins.recovery.retry);
});
it('N loading status uses visible translated copy',()=>{dictionary=en;expect(render()).toContain(en.plugins.recovery.loading);});

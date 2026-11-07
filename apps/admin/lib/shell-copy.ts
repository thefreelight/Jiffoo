import { merchant as en } from 'shared/src/i18n/messages/en/merchant';
import { merchant as hans } from 'shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from 'shared/src/i18n/messages/zh-Hant/merchant';

export const shellCopy = {
  en: { ...en.shell, expandPlugins: 'Expand plugins', collapsePlugins: 'Collapse plugins' },
  'zh-Hans': { ...hans.shell, expandPlugins: '展开插件', collapsePlugins: '收起插件' },
  'zh-Hant': { ...hant.shell, expandPlugins: '展開外掛', collapsePlugins: '收起外掛' },
} as const;

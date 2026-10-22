export const pluginPageLabels = {
  en: { loading: 'Loading plugin page', unavailable: 'This plugin page is unavailable.', retry: 'Try again', save: 'Save file', cancel: 'Cancel', download: 'Download this plugin file?', navigation: 'Plugin pages', returnTo: 'Return to plugin' },
  'zh-Hans': { loading: '正在加载插件页面', unavailable: '此插件页面暂不可用。', retry: '重试', save: '保存文件', cancel: '取消', download: '下载此插件文件？', navigation: '插件页面', returnTo: '返回插件' },
  'zh-Hant': { loading: '正在載入外掛頁面', unavailable: '此外掛頁面暫不可用。', retry: '重試', save: '儲存檔案', cancel: '取消', download: '下載此外掛檔案？', navigation: '外掛頁面', returnTo: '返回外掛' },
} as const;
export type PluginPageLocale = keyof typeof pluginPageLabels;
export type PageDeclaration = { id: string; path: string; title: Record<PluginPageLocale, string>;
  placements?: Array<'header-nav' | 'account-menu' | 'footer'>; requiresLogin?: boolean };
export type PageDeclarations = Array<{ slug: string; pages: PageDeclaration[] }>;
export const pluginShopPath = (slug: string, path: string) => `/apps/${slug}${path === '/' ? '' : path}`;
export const pluginAdminPath = (slug: string, path: string) => `/plugins/${slug}/pages${path === '/' ? '' : path}`;

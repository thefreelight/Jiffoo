import type { Locale } from './themes';

const labels = {
  themes: ['Themes', '主题', '主題'],
  shop: ['Shop', '商店', '商店'],
  admin: ['Admin', '管理后台', '管理後台'],
  upload: ['Upload theme', '上传主题', '上傳主題'],
  package: ['Theme package', '主题安装包', '主題安裝包'],
  confirm: ['I trust this unsigned theme package', '我信任此未签名主题包', '我信任此未簽名主題包'],
  activate: ['Activate', '启用', '啟用'],
  configure: ['Configure', '配置', '設定'],
  uninstall: ['Uninstall', '卸载', '解除安裝'],
  active: ['Active', '正在使用', '正在使用'],
  restore: ['Restore previous theme', '恢复上一个主题', '還原上一個主題'],
  restoreConfig: ['Restore previous configuration', '恢复上一版配置', '還原上一版設定'],
  save: ['Save configuration', '保存配置', '儲存設定'],
  saved: ['Configuration saved', '配置已保存', '設定已儲存'],
  restored: ['Configuration restored', '配置已恢复', '設定已還原'],
  close: ['Close', '关闭', '關閉'],
  loading: ['Loading themes', '正在加载主题', '正在載入主題'],
  empty: ['No themes installed', '尚未安装主题', '尚未安裝主題'],
  failed: ['Theme action failed', '主题操作失败', '主題操作失敗'],
  conflict: ['Configuration changed elsewhere. Latest values have been loaded.', '配置已在别处更改，已加载最新值。', '設定已在其他地方變更，已載入最新值。'],
  search: ['Search products', '搜索商品', '搜尋商品'],
  image: ['Upload image', '上传图片', '上傳圖片'],
  asset: ['Theme asset', '主题资源', '主題資源'],
  choose: ['Choose', '选择', '選擇'],
  homePage: ['Home page', '首页', '首頁'],
  addSection: ['Add section', '添加区块', '新增區塊'],
  editSection: ['Edit section', '编辑区块', '編輯區塊'],
  moveUp: ['Move up', '上移', '上移'],
  moveDown: ['Move down', '下移', '下移'],
  deleteSection: ['Delete', '删除', '刪除'],
  resetHome: ['Reset to theme default', '重置为主题默认', '重設為主題預設'],
  addField: ['Add', '添加', '新增'],
  removeField: ['Remove', '移除', '移除'],
  sourceBuiltin: ['Builtin', '内置', '內建'],
  sourceUploaded: ['Uploaded', '上传', '上傳'],
  validation: ['Theme package is invalid', '主题包无效', '主題包無效'],
  unsafe: ['Unsafe package entry', '安装包中存在不安全文件', '安裝包中有不安全檔案'],
  forbidden: ['Executable or unsupported package entry', '安装包包含可执行或不支持的文件', '安裝包包含可執行或不支援的檔案'],
  size: ['Theme package exceeds a size or entry limit', '主题包超过大小或文件数限制', '主題包超過大小或檔案數限制'],
  schema: ['Invalid theme manifest', '主题清单格式无效', '主題清單格式無效'],
  missing: ['A required theme file or reference is missing', '缺少主题文件或引用', '缺少主題檔案或參照'],
  invalid: ['Invalid theme setting or value', '主题设置或取值无效', '主題設定或值無效'],
  version: ['A newer version is required', '需要更新的版本', '需要更新的版本'],
  noPrevious: ['No previous theme or configuration exists', '没有可恢复的主题或配置', '沒有可還原的主題或設定'],
  protected: ['The active or builtin theme cannot be uninstalled', '不能卸载当前或内置主题', '無法解除安裝目前或內建主題'],
  notFound: ['Theme not found', '找不到主题', '找不到主題'],
} as const;

export type ThemeLabel = keyof typeof labels;
const locales: Locale[] = ['en', 'zh-Hans', 'zh-Hant'];
export const themeMessage = (locale: Locale, key: ThemeLabel) => labels[key][locales.indexOf(locale)];
export const themeErrorKeys = {
  THEME_INVALID_ZIP: 'validation', THEME_MISSING_MANIFEST: 'missing', THEME_INVALID_JSON: 'schema',
  THEME_SCHEMA_INVALID: 'schema', THEME_FORBIDDEN_ENTRY: 'forbidden', THEME_UNSAFE_PATH: 'unsafe',
  THEME_SYMLINK: 'unsafe', THEME_DUPLICATE_ENTRY: 'unsafe', THEME_MAGIC_MISMATCH: 'invalid',
  THEME_PACKAGE_TOO_LARGE: 'size', THEME_TOO_MANY_ENTRIES: 'size', THEME_MANIFEST_TOO_LARGE: 'size',
  THEME_FONT_TOO_LARGE: 'size', THEME_IMAGE_TOO_LARGE: 'size', THEME_FILE_TOO_LARGE: 'size',
  THEME_EXPANDED_TOO_LARGE: 'size', THEME_DUPLICATE_ID: 'schema',
  THEME_MISSING_FILE: 'missing', THEME_INVALID_BINDING: 'invalid', THEME_INVALID_SETTING: 'invalid',
  THEME_UNKNOWN_FONT: 'missing', THEME_INVALID_TOKEN: 'invalid', THEME_UNKNOWN_SETTING: 'missing',
  THEME_SETTING_TYPE_MISMATCH: 'invalid', THEME_INVALID_SECTION: 'invalid',
  THEME_VERSION_CONFLICT: 'version', THEME_BUILTIN_CONFLICT: 'protected',
  THEME_TARGET_CONFLICT: 'invalid', THEME_TARGET_MISMATCH: 'invalid',
  THEME_ACTIVE: 'protected', THEME_NOT_FOUND: 'notFound',
  THEME_CONFIG_INVALID: 'invalid', THEME_CONFIG_CONFLICT: 'conflict',
  THEME_CONFIG_NO_PREVIOUS: 'noPrevious', THEME_NO_PREVIOUS: 'noPrevious',
} as const satisfies Record<string, ThemeLabel>;

export function themeError(locale: Locale, code: string, details?: unknown) {
  const key = themeErrorKeys[code as keyof typeof themeErrorKeys] ?? 'failed';
  const path = details && typeof details === 'object'
    ? (details as { path?: unknown; entry?: unknown }).path ?? (details as { entry?: unknown }).entry
    : undefined;
  return `${themeMessage(locale, key)}${typeof path === 'string' ? `: ${path}` : ''}`;
}

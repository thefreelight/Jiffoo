// Admin 多语言支持
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// 支持的语言类型
export type SupportedLanguage = 
  | 'zh-CN' 
  | 'en-US' 
  | 'ja-JP' 
  | 'ko-KR' 
  | 'es-ES' 
  | 'fr-FR';

// 语言信息接口
export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

// 支持的语言列表
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
];

// 默认语言
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

// 翻译缓存
const translationCache = new Map<string, string>();

// 多语言上下文
interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, defaultValue?: string, interpolations?: Record<string, string>) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 多语言Provider
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // 初始化语言设置
  useEffect(() => {
    const savedLanguage = localStorage.getItem('admin-language') as SupportedLanguage;
    if (savedLanguage && SUPPORTED_LANGUAGES.find(l => l.code === savedLanguage)) {
      setLanguageState(savedLanguage);
    }
    setIsHydrated(true);
  }, []);

  // 设置语言
  const setLanguage = async (lang: SupportedLanguage) => {
    if (lang === language) return;

    setIsLoading(true);
    try {
      // 清除翻译缓存
      translationCache.clear();
      
      // 更新状态
      setLanguageState(lang);
      
      // 保存到本地存储
      localStorage.setItem('admin-language', lang);
      
      // 更新文档语言属性
      document.documentElement.lang = lang.split('-')[0];
      
      // 可以在这里调用后端API同步语言设置
      try {
        await fetch('/api/admin/language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
        });
      } catch (error) {
        console.warn('Failed to sync language to backend:', error);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 翻译函数
  const t = (key: string, defaultValue?: string, interpolations?: Record<string, string>): string => {
    if (!isHydrated) {
      return defaultValue || key;
    }

    const cacheKey = `${language}:${key}`;
    
    // 检查缓存
    if (translationCache.has(cacheKey)) {
      let translation = translationCache.get(cacheKey)!;
      
      // 处理插值
      if (interpolations) {
        Object.entries(interpolations).forEach(([placeholder, value]) => {
          translation = translation.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
        });
      }
      
      return translation;
    }

    // 获取翻译（这里先使用静态翻译，后续可以改为API调用）
    const translation = getStaticTranslation(key, language) || defaultValue || key;
    
    // 缓存翻译
    translationCache.set(cacheKey, translation);
    
    // 处理插值
    let result = translation;
    if (interpolations) {
      Object.entries(interpolations).forEach(([placeholder, value]) => {
        result = result.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
      });
    }
    
    return result;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </I18nContext.Provider>
  );
}

// 使用多语言Hook
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

// 静态翻译数据（临时使用，后续可以改为API调用）
function getStaticTranslation(key: string, language: SupportedLanguage): string | undefined {
  const translations: Record<SupportedLanguage, Record<string, string>> = {
    'zh-CN': {
      // 通用
      'common.save': '保存',
      'common.cancel': '取消',
      'common.delete': '删除',
      'common.edit': '编辑',
      'common.add': '添加',
      'common.search': '搜索',
      'common.filter': '筛选',
      'common.export': '导出',
      'common.import': '导入',
      'common.refresh': '刷新',
      'common.loading': '加载中...',
      'common.success': '成功',
      'common.error': '错误',
      'common.warning': '警告',
      'common.info': '信息',
      'common.confirm': '确认',
      'common.yes': '是',
      'common.no': '否',
      'common.my_account': '我的账户',
      'common.profile': '个人资料',
      'common.logout': '退出登录',
      'common.add_view': '添加视图',
      'common.configure': '配置',
      'common.show_preview': '显示预览',
      'common.hide_preview': '隐藏预览',
      'common.reset': '重置',
      'common.enabled': '已启用',
      'common.disabled': '已禁用',
      
      // 导航
      'nav.dashboard': '仪表板',
      'nav.products': '商品管理',
      'nav.orders': '订单管理',
      'nav.customers': '客户管理',
      'nav.analytics': '数据分析',
      'nav.marketing': '营销管理',
      'nav.plugins': '插件商店',
      'nav.settings': '系统设置',
      'nav.users': '用户管理',
      'nav.licenses': '许可证管理',
      'nav.finance': '财务管理',
      'nav.marketplace': '应用市场',
      'nav.plugin_store': '插件商店',
      'nav.business_model': '商业模式',
      'nav.authentication': '身份认证',
      'nav.utility': '实用工具',
      'nav.pages': '页面',
      'nav.more': '更多',
      
      // 仪表板
      'dashboard.title': '仪表板',
      'dashboard.welcome': '欢迎回来',
      'dashboard.overview': '概览',
      'dashboard.recent_orders': '最近订单',
      'dashboard.sales_chart': '销售图表',
      'dashboard.top_products': '热销商品',
      
      // 商品管理
      'products.title': '商品管理',
      'products.add_product': '添加商品',
      'products.all_products': '所有商品',
      'products.categories': '商品分类',
      'products.inventory': '库存管理',
      'products.product_name': '商品名称',
      'products.price': '价格',
      'products.stock': '库存',
      'products.category': '分类',
      'products.status': '状态',
      
      // 订单管理
      'orders.title': '订单管理',
      'orders.all_orders': '所有订单',
      'orders.pending': '待处理',
      'orders.processing': '处理中',
      'orders.shipped': '已发货',
      'orders.delivered': '已送达',
      'orders.order_id': '订单号',
      'orders.customer': '客户',
      'orders.amount': '金额',
      'orders.status': '状态',
      'orders.date': '日期',
      
      // 客户管理
      'customers.all_customers': '所有客户',
      'customers.groups': '客户群组',
      'customers.reviews': '客户评价',

      // 数据分析
      'analytics.sales_report': '销售报告',
      'analytics.products': '商品分析',
      'analytics.customers': '客户分析',

      // 营销管理
      'marketing.promotions': '促销活动',
      'marketing.coupons': '优惠券',
      'marketing.emails': '邮件营销',

      // 财务管理
      'finance.revenue': '收入统计',
      'finance.payments': '支付管理',
      'finance.refunds': '退款管理',

      // 插件管理
      'plugins.store': '插件商店',
      'plugins.installed': '已安装插件',
      'plugins.licenses': '许可证',

      // 应用市场
      'marketplace.saas_apps': 'SaaS应用',
      'marketplace.auth_plugins': '认证插件',
      'marketplace.my_apps': '我的应用',
      'marketplace.developer': '开发者门户',

      // 用户管理
      'users.title': '用户管理',
      'users.all_users': '所有用户',
      'users.roles': '角色权限',
      'users.activity': '活动日志',
      'users.username': '用户名',
      'users.email': '邮箱',
      'users.role': '角色',
      'users.last_login': '最后登录',

      // 设置
      'settings.title': '系统设置',
      'settings.general': '常规设置',
      'settings.payments': '支付方式',
      'settings.shipping': '配送设置',
      'settings.taxes': '税务设置',
      'settings.language': '语言设置',
      'settings.theme': '主题设置',
      'settings.notifications': '通知设置',
      'settings.language_description': '配置管理界面的语言偏好',
      'settings.current_language': '当前语言',
      'settings.current_language_desc': '选择管理界面的首选语言',
      'settings.auto_detect': '自动检测语言',
      'settings.auto_detect_desc': '从浏览器设置自动检测语言',
      'settings.switcher_preview': '语言切换器预览',
      'settings.switcher_preview_desc': '预览不同的语言切换器样式',
      'settings.available_languages': '可用语言',
      'settings.available_languages_desc': '启用或禁用管理界面的语言',
      'settings.current': '当前',
      'settings.advanced': '高级设置',
      'settings.advanced_desc': '配置高级语言和本地化选项',
      'settings.fallback_language': '后备语言',
      'settings.fallback_desc': '翻译缺失时使用的语言',
      'settings.rtl_support': 'RTL支持',
      'settings.rtl_desc': '为支持的语言启用从右到左的文本方向',
      'settings.date_localization': '日期本地化',
      'settings.date_desc': '根据选定语言格式化日期',
      'settings.number_localization': '数字本地化',
      'settings.number_desc': '根据选定语言格式化数字和货币',
      'settings.language_changed': '语言切换成功',
      'settings.cannot_disable_current': '无法禁用当前语言',
      'settings.saved': '设置保存成功',
      'settings.currency': '货币设置',
      'settings.currency_description': '设置默认货币和格式选项',
      'settings.timezone': '时区',
      'settings.timezone_description': '设置商店的默认时区',
      'settings.advanced_language': '高级语言设置',
      'settings.advanced_language_desc': '配置高级国际化选项',
      'settings.unsaved_changes': '您有未保存的更改',
      'settings.performance': '性能',
      'settings.api': 'API',
      'settings.quality': '质量',
      'settings.analytics': '分析',
      'settings.language_behavior': '语言行为',
      'settings.language_behavior_desc': '配置系统如何处理语言检测和切换',
      'settings.default_language': '默认语言',
      'settings.persist_choice': '持久化语言选择',
      'settings.persist_choice_desc': '跨会话记住用户语言选择',
      'settings.enable_rtl': '启用RTL支持',
      'settings.enable_rtl_desc': '支持从右到左的语言（实验性）',
      'settings.localization': '本地化',
      'settings.localization_desc': '配置日期、数字和货币格式',
      'settings.currency_localization': '货币本地化',
      'settings.currency_desc': '根据选定语言格式化货币',
      'settings.caching': '翻译缓存',
      'settings.caching_desc': '配置翻译缓存以提高性能',
      'settings.enable_cache': '启用翻译缓存',
      'settings.enable_cache_desc': '在内存中缓存翻译以便更快访问',
      'settings.cache_timeout': '缓存超时（分钟）',
      'settings.max_cache_size': '最大缓存大小（条目）',
      'settings.preload_languages': '预加载语言',
      'settings.preload_desc': '预加载语言以便更快切换',
      'settings.translation_api': '翻译API',
      'settings.translation_api_desc': '配置自动翻译服务',
      'settings.enable_api': '启用翻译API',
      'settings.enable_api_desc': '允许使用外部服务进行自动翻译',
      'settings.api_provider': 'API提供商',
      'settings.api_key': 'API密钥',
      'settings.api_key_placeholder': '输入您的API密钥...',
      'settings.rate_limit': '速率限制（请求/分钟）',
      'settings.quality_control': '质量控制',
      'settings.quality_control_desc': '配置翻译质量和验证规则',
      'settings.show_missing': '显示缺失翻译',
      'settings.show_missing_desc': '在开发中突出显示缺失的翻译',
      'settings.log_usage': '记录翻译使用情况',
      'settings.log_usage_desc': '跟踪使用哪些翻译进行分析',
      'settings.translation_coverage': '翻译覆盖率',
      'settings.coverage_desc': '查看每种语言的翻译完成状态',
      'settings.system_info': '系统信息',
      'settings.total_languages': '总语言数',
      'settings.enabled_languages': '启用的语言',
      'settings.cache_status': '缓存状态',
      'settings.api_status': 'API状态',
      'settings.reset': '设置已重置为默认值',

      // 测试页面
      'test.title': '国际化测试',
      'test.description': '多语言功能测试页面',
      'test.current_language': '当前语言',
      'test.current_language_desc': '当前选择语言的信息',
      'test.language_code': '语言代码',
      'test.language_name': '语言名称',
      'test.navigation': '导航翻译',
      'test.navigation_desc': '测试导航菜单翻译',
      'test.common_actions': '通用操作',
      'test.common_actions_desc': '测试通用操作按钮翻译',
      'test.formatting': '本地化格式',
      'test.formatting_desc': '测试日期、数字和货币格式化',
      'test.date_format': '日期格式',
      'test.number_format': '数字格式',
      'test.currency_format': '货币格式',
      'test.interpolation': '字符串插值',
      'test.interpolation_desc': '测试带变量的字符串插值',
      'test.welcome_message': '欢迎回来，{{username}}！',
      'test.item_count': '您的购物车中有 {{count}} 件商品。',
      'test.last_login': '上次登录：{{date}}',
      'test.switcher_styles': '语言切换器样式',
      'test.switcher_styles_desc': '不同的语言切换器组件样式',
      'test.status_messages': '状态消息',
      'test.status_messages_desc': '测试不同状态消息翻译',

      // 翻译管理
      'translation.manager': '翻译管理器',
      'translation.manager_desc': '管理管理界面的翻译',
      'translation.total_keys': '总键数',
      'translation.completed': '已完成',
      'translation.incomplete': '未完成',
      'translation.languages': '语言数',
      'translation.manage': '管理',
      'translation.add_new': '添加新翻译',
      'translation.bulk_edit': '批量编辑',
      'translation.search_placeholder': '搜索翻译...',
      'translation.all_categories': '所有分类',
      'translation.key': '翻译键',
      'translation.category': '分类',
      'translation.description': '描述',
      'translation.translations': '翻译',
      'translation.add': '添加翻译',
      'translation.key_required': '翻译键是必需的',
      'translation.key_exists': '翻译键已存在',
      'translation.added': '翻译添加成功',
      'translation.updated': '翻译更新成功',
      'translation.deleted': '翻译删除成功',
      'translation.exported': '翻译导出成功',
      'translation.no_translation': '无可用翻译',
      'translation.new_category': '新分类',
      'translation.description_placeholder': '描述此翻译的用途...',
      'translation.add_new_desc': '为所有支持的语言创建新的翻译条目',
      'translation.bulk_edit_desc': '一次编辑多个翻译',
      'translation.bulk_coming_soon': '批量编辑功能即将推出...',

      // 多语言编辑器
      'multilingual.required_field': '此字段在至少一种语言中是必需的',
      'multilingual.copy': '复制',
      'multilingual.translate': '翻译',
      'multilingual.completed': '已完成',
      'multilingual.completion_status': '完成状态',
      'multilingual.no_content_to_copy': '没有内容可复制',
      'multilingual.copied_to_empty': '内容已复制到空语言',
      'multilingual.no_content_to_translate': '没有内容可翻译',
      'multilingual.translating': '正在翻译内容...',
      'multilingual.translation_complete': '翻译完成',
      'multilingual.product_editor': '多语言商品编辑器',
      'multilingual.product_editor_desc': '编辑多语言商品信息',
      'multilingual.basic_info': '基本信息',
      'multilingual.basic_info_desc': '基本商品信息',
      'multilingual.product_name': '商品名称',
      'multilingual.enter_product_name': '输入商品名称...',
      'multilingual.short_description': '简短描述',
      'multilingual.enter_short_desc': '输入简短描述...',
      'multilingual.description': '描述',
      'multilingual.enter_description': '输入详细描述...',
      'multilingual.features': '特性',
      'multilingual.enter_features': '输入商品特性...',
      'multilingual.seo_info': 'SEO信息',
      'multilingual.seo_info_desc': '搜索引擎优化内容',
      'multilingual.meta_title': '元标题',
      'multilingual.enter_meta_title': '输入元标题...',
      'multilingual.meta_description': '元描述',
      'multilingual.enter_meta_desc': '输入元描述...',
      'multilingual.preview': '预览',
      'multilingual.preview_desc': '预览内容的显示效果',
      'multilingual.seo_preview': 'SEO预览',
      'multilingual.validation_failed': '请填写必填字段',
      'multilingual.saved_successfully': '商品保存成功',
      'multilingual.usage_tips': '使用提示',
      'multilingual.tip_1': '使用复制按钮将内容复制到空语言',
      'multilingual.tip_2': '使用翻译按钮进行自动翻译（仅演示）',
      'multilingual.tip_3': '必填字段必须至少在一种语言中填写',
      'multilingual.tip_4': 'SEO字段强制执行字符限制',
      'multilingual.tip_5': '绿点表示已完成的语言',
    },
    'en-US': {
      // Common
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.add': 'Add',
      'common.search': 'Search',
      'common.filter': 'Filter',
      'common.export': 'Export',
      'common.import': 'Import',
      'common.refresh': 'Refresh',
      'common.loading': 'Loading...',
      'common.success': 'Success',
      'common.error': 'Error',
      'common.warning': 'Warning',
      'common.info': 'Info',
      'common.confirm': 'Confirm',
      'common.yes': 'Yes',
      'common.no': 'No',
      'common.my_account': 'My Account',
      'common.profile': 'Profile',
      'common.logout': 'Log out',
      'common.add_view': 'Add View',
      'common.configure': 'Configure',
      'common.show_preview': 'Show Preview',
      'common.hide_preview': 'Hide Preview',
      'common.reset': 'Reset',
      'common.enabled': 'Enabled',
      'common.disabled': 'Disabled',
      
      // Navigation
      'nav.dashboard': 'Dashboard',
      'nav.products': 'Products',
      'nav.orders': 'Orders',
      'nav.customers': 'Customers',
      'nav.analytics': 'Analytics',
      'nav.marketing': 'Marketing',
      'nav.plugins': 'Plugins',
      'nav.settings': 'Settings',
      'nav.users': 'Users',
      'nav.licenses': 'Licenses',
      'nav.finance': 'Finance',
      'nav.marketplace': 'Marketplace',
      'nav.plugin_store': 'Plugin Store',
      'nav.business_model': 'Business Model',
      'nav.authentication': 'Authentication',
      'nav.utility': 'Utility',
      'nav.pages': 'PAGES',
      'nav.more': 'MORE',
      
      // Dashboard
      'dashboard.title': 'Dashboard',
      'dashboard.welcome': 'Welcome back',
      'dashboard.overview': 'Overview',
      'dashboard.recent_orders': 'Recent Orders',
      'dashboard.sales_chart': 'Sales Chart',
      'dashboard.top_products': 'Top Products',
      
      // Products
      'products.title': 'Product Management',
      'products.add_product': 'Add Product',
      'products.all_products': 'All Products',
      'products.categories': 'Categories',
      'products.inventory': 'Inventory',
      'products.product_name': 'Product Name',
      'products.price': 'Price',
      'products.stock': 'Stock',
      'products.category': 'Category',
      'products.status': 'Status',

      // Orders
      'orders.title': 'Order Management',
      'orders.all_orders': 'All Orders',
      'orders.pending': 'Pending',
      'orders.processing': 'Processing',
      'orders.shipped': 'Shipped',
      'orders.delivered': 'Delivered',
      'orders.order_id': 'Order ID',
      'orders.customer': 'Customer',
      'orders.amount': 'Amount',
      'orders.status': 'Status',
      'orders.date': 'Date',

      // Customers
      'customers.all_customers': 'All Customers',
      'customers.groups': 'Customer Groups',
      'customers.reviews': 'Reviews',

      // Analytics
      'analytics.sales_report': 'Sales Report',
      'analytics.products': 'Product Analytics',
      'analytics.customers': 'Customer Analytics',

      // Marketing
      'marketing.promotions': 'Promotions',
      'marketing.coupons': 'Coupons',
      'marketing.emails': 'Email Campaigns',

      // Finance
      'finance.revenue': 'Revenue',
      'finance.payments': 'Payments',
      'finance.refunds': 'Refunds',

      // Plugins
      'plugins.store': 'Plugin Store',
      'plugins.installed': 'Installed Plugins',
      'plugins.licenses': 'Licenses',

      // Marketplace
      'marketplace.saas_apps': 'SaaS Apps',
      'marketplace.auth_plugins': 'Auth Plugins',
      'marketplace.my_apps': 'My Apps',
      'marketplace.developer': 'Developer Portal',

      // Users
      'users.title': 'User Management',
      'users.all_users': 'All Users',
      'users.roles': 'Roles & Permissions',
      'users.activity': 'Activity Log',
      'users.username': 'Username',
      'users.email': 'Email',
      'users.role': 'Role',
      'users.last_login': 'Last Login',

      // Settings
      'settings.title': 'Settings',
      'settings.general': 'General',
      'settings.payments': 'Payment Methods',
      'settings.shipping': 'Shipping',
      'settings.taxes': 'Taxes',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'settings.notifications': 'Notifications',
      'settings.language_description': 'Configure language preferences for the admin interface',
      'settings.current_language': 'Current Language',
      'settings.current_language_desc': 'Select your preferred language for the admin interface',
      'settings.auto_detect': 'Auto-detect language',
      'settings.auto_detect_desc': 'Automatically detect language from browser settings',
      'settings.switcher_preview': 'Language Switcher Preview',
      'settings.switcher_preview_desc': 'Preview different language switcher styles',
      'settings.available_languages': 'Available Languages',
      'settings.available_languages_desc': 'Enable or disable languages for your admin interface',
      'settings.current': 'Current',
      'settings.advanced': 'Advanced Settings',
      'settings.advanced_desc': 'Configure advanced language and localization options',
      'settings.fallback_language': 'Fallback Language',
      'settings.fallback_desc': 'Language to use when translations are missing',
      'settings.rtl_support': 'RTL Support',
      'settings.rtl_desc': 'Enable right-to-left text direction for supported languages',
      'settings.date_localization': 'Date Localization',
      'settings.date_desc': 'Format dates according to selected language',
      'settings.number_localization': 'Number Localization',
      'settings.number_desc': 'Format numbers and currency according to selected language',
      'settings.language_changed': 'Language changed successfully',
      'settings.cannot_disable_current': 'Cannot disable current language',
      'settings.saved': 'Settings saved successfully',
      'settings.currency': 'Currency Settings',
      'settings.currency_description': 'Set default currency and formatting options',
      'settings.timezone': 'Timezone',
      'settings.timezone_description': 'Set the default timezone for your store',
      'settings.advanced_language': 'Advanced Language Settings',
      'settings.advanced_language_desc': 'Configure advanced internationalization options',
      'settings.unsaved_changes': 'You have unsaved changes',
      'settings.performance': 'Performance',
      'settings.api': 'API',
      'settings.quality': 'Quality',
      'settings.analytics': 'Analytics',
      'settings.language_behavior': 'Language Behavior',
      'settings.language_behavior_desc': 'Configure how the system handles language detection and switching',
      'settings.default_language': 'Default Language',
      'settings.persist_choice': 'Persist Language Choice',
      'settings.persist_choice_desc': 'Remember user language selection across sessions',
      'settings.enable_rtl': 'Enable RTL Support',
      'settings.enable_rtl_desc': 'Support right-to-left languages (experimental)',
      'settings.localization': 'Localization',
      'settings.localization_desc': 'Configure date, number, and currency formatting',
      'settings.currency_localization': 'Currency Localization',
      'settings.currency_desc': 'Format currency according to selected language',
      'settings.caching': 'Translation Caching',
      'settings.caching_desc': 'Configure translation caching for better performance',
      'settings.enable_cache': 'Enable Translation Cache',
      'settings.enable_cache_desc': 'Cache translations in memory for faster access',
      'settings.cache_timeout': 'Cache Timeout (minutes)',
      'settings.max_cache_size': 'Max Cache Size (entries)',
      'settings.preload_languages': 'Preload Languages',
      'settings.preload_desc': 'Languages to preload for faster switching',
      'settings.translation_api': 'Translation API',
      'settings.translation_api_desc': 'Configure automatic translation services',
      'settings.enable_api': 'Enable Translation API',
      'settings.enable_api_desc': 'Allow automatic translation using external services',
      'settings.api_provider': 'API Provider',
      'settings.api_key': 'API Key',
      'settings.api_key_placeholder': 'Enter your API key...',
      'settings.rate_limit': 'Rate Limit (requests/minute)',
      'settings.quality_control': 'Quality Control',
      'settings.quality_control_desc': 'Configure translation quality and validation rules',
      'settings.show_missing': 'Show Missing Translations',
      'settings.show_missing_desc': 'Highlight missing translations in development',
      'settings.log_usage': 'Log Translation Usage',
      'settings.log_usage_desc': 'Track which translations are used for analytics',
      'settings.translation_coverage': 'Translation Coverage',
      'settings.coverage_desc': 'View translation completion status for each language',
      'settings.system_info': 'System Information',
      'settings.total_languages': 'Total Languages',
      'settings.enabled_languages': 'Enabled Languages',
      'settings.cache_status': 'Cache Status',
      'settings.api_status': 'API Status',
      'settings.reset': 'Settings reset to default',

      // Test page
      'test.title': 'Internationalization Test',
      'test.description': 'Test page for multi-language functionality',
      'test.current_language': 'Current Language',
      'test.current_language_desc': 'Information about the currently selected language',
      'test.language_code': 'Language Code',
      'test.language_name': 'Language Name',
      'test.navigation': 'Navigation Translations',
      'test.navigation_desc': 'Test navigation menu translations',
      'test.common_actions': 'Common Actions',
      'test.common_actions_desc': 'Test common action button translations',
      'test.formatting': 'Localization Formatting',
      'test.formatting_desc': 'Test date, number, and currency formatting',
      'test.date_format': 'Date Format',
      'test.number_format': 'Number Format',
      'test.currency_format': 'Currency Format',
      'test.interpolation': 'String Interpolation',
      'test.interpolation_desc': 'Test string interpolation with variables',
      'test.welcome_message': 'Welcome back, {{username}}!',
      'test.item_count': 'You have {{count}} items in your cart.',
      'test.last_login': 'Last login: {{date}}',
      'test.switcher_styles': 'Language Switcher Styles',
      'test.switcher_styles_desc': 'Different language switcher component styles',
      'test.status_messages': 'Status Messages',
      'test.status_messages_desc': 'Test different status message translations',

      // Translation management
      'translation.manager': 'Translation Manager',
      'translation.manager_desc': 'Manage translations for the admin interface',
      'translation.total_keys': 'Total Keys',
      'translation.completed': 'Completed',
      'translation.incomplete': 'Incomplete',
      'translation.languages': 'Languages',
      'translation.manage': 'Manage',
      'translation.add_new': 'Add New',
      'translation.bulk_edit': 'Bulk Edit',
      'translation.search_placeholder': 'Search translations...',
      'translation.all_categories': 'All Categories',
      'translation.key': 'Translation Key',
      'translation.category': 'Category',
      'translation.description': 'Description',
      'translation.translations': 'Translations',
      'translation.add': 'Add Translation',
      'translation.key_required': 'Translation key is required',
      'translation.key_exists': 'Translation key already exists',
      'translation.added': 'Translation added successfully',
      'translation.updated': 'Translation updated successfully',
      'translation.deleted': 'Translation deleted successfully',
      'translation.exported': 'Translations exported successfully',
      'translation.no_translation': 'No translation available',
      'translation.new_category': 'New Category',
      'translation.description_placeholder': 'Describe what this translation is used for...',
      'translation.add_new_desc': 'Create a new translation entry for all supported languages',
      'translation.bulk_edit_desc': 'Edit multiple translations at once',
      'translation.bulk_coming_soon': 'Bulk edit functionality coming soon...',

      // Multilingual editor
      'multilingual.required_field': 'This field is required in at least one language',
      'multilingual.copy': 'Copy',
      'multilingual.translate': 'Translate',
      'multilingual.completed': 'Completed',
      'multilingual.completion_status': 'Completion Status',
      'multilingual.no_content_to_copy': 'No content to copy',
      'multilingual.copied_to_empty': 'Content copied to empty languages',
      'multilingual.no_content_to_translate': 'No content to translate',
      'multilingual.translating': 'Translating content...',
      'multilingual.translation_complete': 'Translation completed',
      'multilingual.product_editor': 'Multilingual Product Editor',
      'multilingual.product_editor_desc': 'Edit product information in multiple languages',
      'multilingual.basic_info': 'Basic Information',
      'multilingual.basic_info_desc': 'Essential product information',
      'multilingual.product_name': 'Product Name',
      'multilingual.enter_product_name': 'Enter product name...',
      'multilingual.short_description': 'Short Description',
      'multilingual.enter_short_desc': 'Enter short description...',
      'multilingual.description': 'Description',
      'multilingual.enter_description': 'Enter detailed description...',
      'multilingual.features': 'Features',
      'multilingual.enter_features': 'Enter product features...',
      'multilingual.seo_info': 'SEO Information',
      'multilingual.seo_info_desc': 'Search engine optimization content',
      'multilingual.meta_title': 'Meta Title',
      'multilingual.enter_meta_title': 'Enter meta title...',
      'multilingual.meta_description': 'Meta Description',
      'multilingual.enter_meta_desc': 'Enter meta description...',
      'multilingual.preview': 'Preview',
      'multilingual.preview_desc': 'Preview how the content will appear',
      'multilingual.seo_preview': 'SEO Preview',
      'multilingual.validation_failed': 'Please fill in required fields',
      'multilingual.saved_successfully': 'Product saved successfully',
      'multilingual.usage_tips': 'Usage Tips',
      'multilingual.tip_1': 'Use the Copy button to duplicate content to empty languages',
      'multilingual.tip_2': 'Use the Translate button for automatic translation (demo only)',
      'multilingual.tip_3': 'Required fields must be filled in at least one language',
      'multilingual.tip_4': 'Character limits are enforced for SEO fields',
      'multilingual.tip_5': 'Green dots indicate completed languages',
    },
    // 其他语言的翻译可以后续添加
    'ja-JP': {},
    'ko-KR': {},
    'es-ES': {},
    'fr-FR': {},
  };

  return translations[language]?.[key];
}

// 获取语言信息
export function getLanguageInfo(code: SupportedLanguage): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

// 格式化日期
export function formatDate(date: Date, language: SupportedLanguage): string {
  const localeMap: Record<SupportedLanguage, string> = {
    'zh-CN': 'zh-CN',
    'en-US': 'en-US',
    'ja-JP': 'ja-JP',
    'ko-KR': 'ko-KR',
    'es-ES': 'es-ES',
    'fr-FR': 'fr-FR',
  };

  return date.toLocaleDateString(localeMap[language], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// 格式化数字
export function formatNumber(number: number, language: SupportedLanguage): string {
  const localeMap: Record<SupportedLanguage, string> = {
    'zh-CN': 'zh-CN',
    'en-US': 'en-US',
    'ja-JP': 'ja-JP',
    'ko-KR': 'ko-KR',
    'es-ES': 'es-ES',
    'fr-FR': 'fr-FR',
  };

  return number.toLocaleString(localeMap[language]);
}

// 格式化货币
export function formatCurrency(amount: number, currency: string, language: SupportedLanguage): string {
  const localeMap: Record<SupportedLanguage, string> = {
    'zh-CN': 'zh-CN',
    'en-US': 'en-US',
    'ja-JP': 'ja-JP',
    'ko-KR': 'ko-KR',
    'es-ES': 'es-ES',
    'fr-FR': 'fr-FR',
  };

  return new Intl.NumberFormat(localeMap[language], {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

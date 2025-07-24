'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// 多语言上下文接口
interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: string, defaultValue?: string, interpolations?: Record<string, string>) => string;
  isLoading: boolean;
}

// 创建上下文
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 翻译缓存
const translationCache = new Map<string, string>();

// 多语言Provider组件
interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: SupportedLanguage;
}

export function I18nProvider({ children, defaultLanguage = 'zh-CN' }: I18nProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>(defaultLanguage);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // 客户端水合
  useEffect(() => {
    setIsHydrated(true);
    
    // 从localStorage获取保存的语言
    const savedLanguage = localStorage.getItem('admin-language') as SupportedLanguage;
    if (savedLanguage && SUPPORTED_LANGUAGES.some(lang => lang.code === savedLanguage)) {
      setLanguageState(savedLanguage);
    } else {
      // 自动检测浏览器语言
      const browserLanguage = detectBrowserLanguage();
      if (browserLanguage) {
        setLanguageState(browserLanguage);
      }
    }
    
    setIsLoading(false);
  }, []);

  // 设置语言
  const setLanguage = async (newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage);
    
    // 保存到localStorage
    localStorage.setItem('admin-language', newLanguage);
    
    // 调用API保存到服务器
    try {
      await fetch('/api/admin/language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: newLanguage }),
      });
    } catch (error) {
      console.warn('Failed to save language preference to server:', error);
    }
  };

  // 检测浏览器语言
  const detectBrowserLanguage = (): SupportedLanguage | null => {
    if (typeof navigator === 'undefined') return null;
    
    const browserLang = navigator.language || navigator.languages?.[0];
    if (!browserLang) return null;
    
    // 精确匹配
    const exactMatch = SUPPORTED_LANGUAGES.find(lang => lang.code === browserLang);
    if (exactMatch) return exactMatch.code;
    
    // 语言代码匹配（如 zh 匹配 zh-CN）
    const langCode = browserLang.split('-')[0];
    const partialMatch = SUPPORTED_LANGUAGES.find(lang => lang.code.startsWith(langCode + '-'));
    
    return partialMatch?.code || null;
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
      'plugins.payment_test': '支付测试',

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
      'settings.system_updates': '系统更新',
      'settings.language': '语言设置',
      'settings.theme': '主题设置',
      'settings.notifications': '通知设置',
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
      'plugins.payment_test': 'Payment Test',

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
      'settings.system_updates': 'System Updates',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'settings.notifications': 'Notifications',
    },
    // 其他语言的基础翻译
    'ja-JP': {
      'common.save': '保存',
      'common.cancel': 'キャンセル',
      'nav.dashboard': 'ダッシュボード',
      'nav.products': '商品',
      'nav.orders': '注文',
      'nav.settings': '設定',
    },
    'ko-KR': {
      'common.save': '저장',
      'common.cancel': '취소',
      'nav.dashboard': '대시보드',
      'nav.products': '상품',
      'nav.orders': '주문',
      'nav.settings': '설정',
    },
    'es-ES': {
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'nav.dashboard': 'Panel',
      'nav.products': 'Productos',
      'nav.orders': 'Pedidos',
      'nav.settings': 'Configuración',
    },
    'fr-FR': {
      'common.save': 'Enregistrer',
      'common.cancel': 'Annuler',
      'nav.dashboard': 'Tableau de bord',
      'nav.products': 'Produits',
      'nav.orders': 'Commandes',
      'nav.settings': 'Paramètres',
    },
  };

  return translations[language]?.[key];
}

// 格式化函数
export function formatDate(date: Date, language: SupportedLanguage): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  return new Intl.DateTimeFormat(language, options).format(date);
}

export function formatCurrency(amount: number, currency: string, language: SupportedLanguage): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatNumber(number: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(language).format(number);
}

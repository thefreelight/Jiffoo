'use client';

import { useState, useEffect, useCallback } from 'react';
import { i18nApi } from '@/lib/api';

// 简单的翻译缓存
const translationCache = new Map<string, string>();
const loadingKeys = new Set<string>();

// 静态翻译数据作为后备
const staticTranslations: Record<string, Record<string, string>> = {
  'en-US': {
    'common.profile.title': 'Profile',
    'common.profile.items': 'Profile Items',
    'common.profile.edit': 'Edit Profile',
    'common.profile.settings': 'Settings',
    'common.profile.logout': 'Logout',
    'common.loading': 'Loading...',
    'common.error': 'Error',
  },
  'zh-CN': {
    'common.profile.title': '个人资料',
    'common.profile.items': '资料项目',
    'common.profile.edit': '编辑资料',
    'common.profile.settings': '设置',
    'common.profile.logout': '退出登录',
    'common.loading': '加载中...',
    'common.error': '错误',
  },
  'ja-JP': {
    'common.profile.title': 'プロフィール',
    'common.profile.items': 'プロフィール項目',
    'common.profile.edit': 'プロフィール編集',
    'common.profile.settings': '設定',
    'common.profile.logout': 'ログアウト',
    'common.loading': '読み込み中...',
    'common.error': 'エラー',
  },
};

export function useTranslation() {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en-US');
  const [isHydrated, setIsHydrated] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // 处理 SSR 水合
  useEffect(() => {
    setIsHydrated(true);
    const savedLanguage = localStorage.getItem('language') || 'en-US';
    setCurrentLanguage(savedLanguage);
    
    // 加载静态翻译
    const staticData = staticTranslations[savedLanguage] || staticTranslations['en-US'];
    setTranslations(staticData);
    
    // 缓存静态翻译
    Object.entries(staticData).forEach(([key, value]) => {
      const cacheKey = `${savedLanguage}:${key}`;
      translationCache.set(cacheKey, value);
    });
  }, []);

  // 异步加载翻译（在后台进行）
  const loadTranslation = useCallback(async (key: string, namespace: string = 'common') => {
    const fullKey = `${namespace}.${key}`;
    const cacheKey = `${currentLanguage}:${fullKey}`;
    
    // 避免重复加载
    if (loadingKeys.has(cacheKey)) {
      return;
    }
    
    loadingKeys.add(cacheKey);
    
    try {
      const response = await i18nApi.getTranslation(fullKey, currentLanguage);
      const translation = response?.data?.value;
      
      if (translation) {
        translationCache.set(cacheKey, translation);
        setTranslations(prev => ({
          ...prev,
          [fullKey]: translation
        }));
      }
    } catch (error) {
      console.warn(`Failed to load translation: ${fullKey}`, error);
    } finally {
      loadingKeys.delete(cacheKey);
    }
  }, [currentLanguage]);

  // 同步翻译函数
  const t = useCallback((key: string, namespace: string = 'common', defaultValue?: string): string => {
    if (!isHydrated) {
      return defaultValue || key;
    }

    const fullKey = `${namespace}.${key}`;
    const cacheKey = `${currentLanguage}:${fullKey}`;

    // 检查缓存
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    // 检查当前翻译状态
    if (translations[fullKey]) {
      return translations[fullKey];
    }

    // 异步加载翻译（不阻塞渲染）
    loadTranslation(key, namespace);

    // 返回默认值
    return defaultValue || key;
  }, [currentLanguage, isHydrated, translations, loadTranslation]);

  // 切换语言
  const switchLanguage = useCallback((language: string) => {
    localStorage.setItem('language', language);
    setCurrentLanguage(language);
    
    // 加载新语言的静态翻译
    const staticData = staticTranslations[language] || staticTranslations['en-US'];
    setTranslations(staticData);
    
    // 清除旧缓存，加载新缓存
    translationCache.clear();
    Object.entries(staticData).forEach(([key, value]) => {
      const cacheKey = `${language}:${key}`;
      translationCache.set(cacheKey, value);
    });
  }, []);

  return {
    t,
    currentLanguage,
    switchLanguage,
    isHydrated,
  };
}

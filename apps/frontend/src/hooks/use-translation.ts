'use client';

import { useState, useEffect } from 'react';
import { i18nApi } from '@/lib/api';

// 简单的翻译缓存
const translationCache = new Map<string, string>();

export function useTranslation() {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en-US');
  const [isHydrated, setIsHydrated] = useState(false);

  // 处理 SSR 水合
  useEffect(() => {
    setIsHydrated(true);
    const savedLanguage = localStorage.getItem('language') || 'en-US';
    if (savedLanguage !== currentLanguage) {
      translationCache.clear();
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const savedLanguage = localStorage.getItem('language') || 'en-US';
    if (savedLanguage !== currentLanguage) {
      // 清除缓存，因为语言已经改变
      translationCache.clear();
      setCurrentLanguage(savedLanguage);
    }
  }, [currentLanguage, isHydrated]);

  // 监听语言变化事件
  useEffect(() => {
    const handleLanguageChange = () => {
      const newLanguage = localStorage.getItem('language') || 'en-US';
      if (newLanguage !== currentLanguage) {
        translationCache.clear();
        setCurrentLanguage(newLanguage);
      }
    };

    window.addEventListener('storage', handleLanguageChange);
    return () => window.removeEventListener('storage', handleLanguageChange);
  }, [currentLanguage]);

  const t = async (key: string, namespace: string = 'common', defaultValue?: string): Promise<string> => {
    // 如果还没有水合，返回默认值
    if (!isHydrated) {
      return defaultValue || key;
    }

    const cacheKey = `${currentLanguage}:${namespace}.${key}`;

    // 检查缓存
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    try {
      const response = await i18nApi.getTranslation(`${namespace}.${key}`, currentLanguage);
      const translation = response?.data?.value || defaultValue || key;

      // 缓存翻译
      translationCache.set(cacheKey, translation);

      return translation;
    } catch (error) {
      console.error('Translation error:', error);
      const fallback = defaultValue || key;
      // 缓存失败的翻译，避免重复请求
      translationCache.set(cacheKey, fallback);
      return fallback;
    }
  };

  // 同步版本，用于已缓存的翻译
  const tSync = (key: string, namespace: string = 'common', defaultValue?: string): string => {
    const cacheKey = `${currentLanguage}:${namespace}.${key}`;
    return translationCache.get(cacheKey) || defaultValue || key;
  };

  return {
    t,
    tSync,
    currentLanguage,
  };
}

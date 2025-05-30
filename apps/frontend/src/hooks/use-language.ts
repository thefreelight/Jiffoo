'use client';

import { useState, useEffect, useCallback } from 'react';
import { i18nApi } from '@/lib/api';
import { toast } from '@/components/ui/toaster';

export function useLanguage() {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en-US');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize language from localStorage or browser preference
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      setCurrentLanguage(savedLanguage);
    } else {
      // Detect browser language
      const browserLang = navigator.language;
      const supportedLanguages = ['en-US', 'zh-CN', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR'];
      
      if (supportedLanguages.includes(browserLang)) {
        setCurrentLanguage(browserLang);
      } else if (browserLang.startsWith('zh')) {
        setCurrentLanguage('zh-CN');
      } else if (browserLang.startsWith('en')) {
        setCurrentLanguage('en-US');
      }
    }
  }, []);

  const changeLanguage = useCallback(async (language: string) => {
    if (language === currentLanguage) return;

    setIsLoading(true);
    try {
      // Call backend API to switch language
      await i18nApi.switchLanguage(language);
      
      // Update local state and storage
      setCurrentLanguage(language);
      localStorage.setItem('language', language);
      
      // Update document language
      document.documentElement.lang = language.split('-')[0];
      
      // Show success message
      toast({
        title: 'Language Changed',
        description: `Language switched to ${language}`,
      });

      // Reload page to apply language changes
      window.location.reload();
    } catch (error) {
      console.error('Failed to change language:', error);
      toast({
        title: 'Error',
        description: 'Failed to change language. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentLanguage]);

  return {
    currentLanguage,
    changeLanguage,
    isLoading,
  };
}

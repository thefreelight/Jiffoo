'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/use-translation';

export function TranslationTest() {
  const { t, currentLanguage } = useTranslation();
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isClient, setIsClient] = useState(false);

  // 处理客户端水合
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const loadTranslations = async () => {
      // 清空之前的翻译
      setTranslations({});

      const keys = [
        { key: 'welcome', namespace: 'common', default: 'Welcome' },
        { key: 'hello', namespace: 'common', default: 'Hello' },
        { key: 'home', namespace: 'navigation', default: 'Home' },
        { key: 'products', namespace: 'navigation', default: 'Products' },
        { key: 'add_to_cart', namespace: 'ecommerce', default: 'Add to Cart' },
      ];

      const newTranslations: Record<string, string> = {};

      for (const { key, namespace, default: defaultValue } of keys) {
        try {
          const translation = await t(key, namespace, defaultValue);
          newTranslations[`${namespace}.${key}`] = translation;
        } catch (error) {
          console.error(`Failed to load translation for ${namespace}.${key}:`, error);
          newTranslations[`${namespace}.${key}`] = defaultValue;
        }
      }

      setTranslations(newTranslations);
    };

    if (currentLanguage) {
      loadTranslations();
    }
  }, [currentLanguage, isClient, t]);

  // 在服务器端渲染时显示加载状态，避免水合错误
  if (!isClient) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <h3 className="font-bold mb-2">Translation Test (Language: en-US)</h3>
        <div className="space-y-1 text-sm">
          <div>Loading translations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="font-bold mb-2">Translation Test (Language: {currentLanguage})</h3>
      <div className="space-y-1 text-sm">
        {Object.keys(translations).length === 0 ? (
          <div>Loading translations...</div>
        ) : (
          Object.entries(translations).map(([key, value]) => (
            <div key={key}>
              <span className="font-mono text-gray-600">{key}:</span> {value}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

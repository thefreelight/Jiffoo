'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/use-translation';

export function TranslationTest() {
  const { currentLanguage } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // 处理客户端水合
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 简化的翻译加载，避免异步操作导致的循环
  useEffect(() => {
    if (!isClient) return;

    // 使用简单的静态翻译映射来演示
    const translationMap: Record<string, Record<string, string>> = {
      'en-US': {
        'common.welcome': 'Welcome',
        'common.hello': 'Hello',
        'navigation.home': 'Home',
        'navigation.products': 'Products',
        'ecommerce.add_to_cart': 'Add to Cart',
      },
      'zh-CN': {
        'common.welcome': '欢迎',
        'common.hello': '你好',
        'navigation.home': '首页',
        'navigation.products': '商品',
        'ecommerce.add_to_cart': '加入购物车',
      },
      'ja-JP': {
        'common.welcome': 'ようこそ',
        'common.hello': 'こんにちは',
        'navigation.home': 'ホーム',
        'navigation.products': '商品',
        'ecommerce.add_to_cart': 'カートに追加',
      },
    };

    const currentTranslations = translationMap[currentLanguage] || translationMap['en-US'];
    setTranslations(currentTranslations);
  }, [currentLanguage, isClient]);

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

'use client';

import { useTranslation } from '@/hooks/use-translation';

export function FeaturedProducts() {
  const { currentLanguage } = useTranslation();

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Featured Products',
      subtitle: 'Discover our most popular items',
      product: 'Product',
    },
    'zh-CN': {
      title: '精选商品',
      subtitle: '发现我们最受欢迎的商品',
      product: '商品',
    },
    'ja-JP': {
      title: '注目商品',
      subtitle: '最も人気のあるアイテムを発見',
      product: '商品',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Product cards will be implemented here */}
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">{t('product')} 1</span>
          </div>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">{t('product')} 2</span>
          </div>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">{t('product')} 3</span>
          </div>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">{t('product')} 4</span>
          </div>
        </div>
      </div>
    </section>
  );
}

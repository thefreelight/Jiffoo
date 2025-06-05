'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ShoppingCart, Minus, Plus, Share2, Truck, Shield, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Mock product data
const productData: Record<string, any> = {
  '1': {
    id: 1,
    name: 'Wireless Headphones',
    nameZh: '无线耳机',
    nameJa: 'ワイヤレスヘッドフォン',
    price: 99.99,
    originalPrice: 129.99,
    rating: 4.5,
    reviews: 128,
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=600&fit=crop',
    ],
    category: 'Electronics',
    isNew: false,
    isSale: true,
    description: 'Premium wireless headphones with noise cancellation and superior sound quality.',
    descriptionZh: '具有降噪功能和卓越音质的高级无线耳机。',
    descriptionJa: 'ノイズキャンセリング機能と優れた音質を備えたプレミアムワイヤレスヘッドフォン。',
    features: [
      'Active Noise Cancellation',
      '30-hour battery life',
      'Quick charge: 5 min = 3 hours',
      'Premium materials',
      'Wireless charging case'
    ],
    featuresZh: [
      '主动降噪',
      '30小时电池续航',
      '快速充电：5分钟=3小时',
      '优质材料',
      '无线充电盒'
    ],
    featuresJa: [
      'アクティブノイズキャンセリング',
      '30時間のバッテリー寿命',
      'クイックチャージ：5分=3時間',
      'プレミアム素材',
      'ワイヤレス充電ケース'
    ],
    inStock: true,
    stockCount: 15,
  },
  '2': {
    id: 2,
    name: 'Smart Watch',
    nameZh: '智能手表',
    nameJa: 'スマートウォッチ',
    price: 199.99,
    originalPrice: null,
    rating: 4.8,
    reviews: 89,
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
      'https://images.unsplash.com/photo-1544117519-31a4b719223d?w=600&h=600&fit=crop',
    ],
    category: 'Electronics',
    isNew: true,
    isSale: false,
    description: 'Advanced smartwatch with health monitoring and fitness tracking.',
    descriptionZh: '具有健康监测和健身追踪功能的先进智能手表。',
    descriptionJa: '健康モニタリングとフィットネストラッキング機能を備えた先進的なスマートウォッチ。',
    features: [
      'Heart rate monitoring',
      'GPS tracking',
      'Water resistant',
      '7-day battery life',
      'Sleep tracking'
    ],
    featuresZh: [
      '心率监测',
      'GPS追踪',
      '防水',
      '7天电池续航',
      '睡眠追踪'
    ],
    featuresJa: [
      '心拍数モニタリング',
      'GPS追跡',
      '防水',
      '7日間のバッテリー寿命',
      '睡眠追跡'
    ],
    inStock: true,
    stockCount: 8,
  },
};

interface ProductPageProps {
  params: {
    id: string;
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const { currentLanguage } = useTranslation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = React.useState(0);
  const [quantity, setQuantity] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);

  const product = productData[params.id];

  if (!product) {
    notFound();
  }

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      backToProducts: 'Back to Products',
      addToCart: 'Add to Cart',
      addToWishlist: 'Add to Wishlist',
      share: 'Share',
      quantity: 'Quantity',
      inStock: 'In Stock',
      outOfStock: 'Out of Stock',
      reviews: 'reviews',
      features: 'Features',
      description: 'Description',
      freeShipping: 'Free Shipping',
      securePayment: 'Secure Payment',
      easyReturns: 'Easy Returns',
      sale: 'Sale',
      new: 'New',
      stockLeft: '{count} left in stock',
      adding: 'Adding...',
      addedToCart: 'Added to Cart',
      addedToCartDesc: 'has been added to your cart',
      error: 'Error',
      addToCartError: 'Failed to add item to cart',
    },
    'zh-CN': {
      backToProducts: '返回商品',
      addToCart: '加入购物车',
      addToWishlist: '加入收藏',
      share: '分享',
      quantity: '数量',
      inStock: '有库存',
      outOfStock: '缺货',
      reviews: '条评价',
      features: '特性',
      description: '描述',
      freeShipping: '免费配送',
      securePayment: '安全支付',
      easyReturns: '轻松退货',
      sale: '促销',
      new: '新品',
      stockLeft: '库存剩余 {count} 件',
      adding: '添加中...',
      addedToCart: '已加入购物车',
      addedToCartDesc: '已添加到您的购物车',
      error: '错误',
      addToCartError: '添加商品到购物车失败',
    },
    'ja-JP': {
      backToProducts: '商品に戻る',
      addToCart: 'カートに追加',
      addToWishlist: 'ウィッシュリストに追加',
      share: '共有',
      quantity: '数量',
      inStock: '在庫あり',
      outOfStock: '在庫切れ',
      reviews: 'レビュー',
      features: '特徴',
      description: '説明',
      freeShipping: '送料無料',
      securePayment: '安全な支払い',
      easyReturns: '簡単返品',
      sale: 'セール',
      new: '新商品',
      stockLeft: '在庫残り{count}個',
      adding: '追加中...',
      addedToCart: 'カートに追加しました',
      addedToCartDesc: 'がカートに追加されました',
      error: 'エラー',
      addToCartError: 'カートへの追加に失敗しました',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const getProductName = () => {
    switch (currentLanguage) {
      case 'zh-CN':
        return product.nameZh;
      case 'ja-JP':
        return product.nameJa;
      default:
        return product.name;
    }
  };

  const getProductDescription = () => {
    switch (currentLanguage) {
      case 'zh-CN':
        return product.descriptionZh;
      case 'ja-JP':
        return product.descriptionJa;
      default:
        return product.description;
    }
  };

  const getProductFeatures = () => {
    switch (currentLanguage) {
      case 'zh-CN':
        return product.featuresZh;
      case 'ja-JP':
        return product.featuresJa;
      default:
        return product.features;
    }
  };

  const handleAddToCart = async () => {
    try {
      setIsLoading(true);
      await addToCart(product.id.toString(), quantity);

      toast({
        title: t('addedToCart'),
        description: `${getProductName()} ${t('addedToCartDesc')}`,
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('addToCartError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/products"
            className="text-primary hover:underline"
          >
            ← {t('backToProducts')}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="aspect-square overflow-hidden rounded-xl bg-muted"
            >
              <Image
                src={product.images[selectedImage]}
                alt={getProductName()}
                width={600}
                height={600}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Thumbnail Images */}
            <div className="flex gap-4">
              {product.images.map((image: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square w-20 overflow-hidden rounded-lg border-2 transition-colors ${
                    selectedImage === index ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`${getProductName()} ${index + 1}`}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Badges */}
              <div className="flex gap-2 mb-4">
                {product.isNew && (
                  <span className="bg-green-500 text-white text-sm px-3 py-1 rounded-full">
                    {t('new')}
                  </span>
                )}
                {product.isSale && (
                  <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                    {t('sale')}
                  </span>
                )}
              </div>

              {/* Product Name */}
              <h1 className="text-3xl lg:text-4xl font-bold mb-4">
                {getProductName()}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg">
                  {product.rating} ({product.reviews} {t('reviews')})
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl font-bold">${product.price}</span>
                {product.originalPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    ${product.originalPrice}
                  </span>
                )}
              </div>

              {/* Stock Status */}
              <div className="mb-6">
                {product.inStock ? (
                  <div className="text-green-600">
                    <span className="font-medium">{t('inStock')}</span>
                    <span className="text-sm ml-2">
                      {t('stockLeft').replace('{count}', product.stockCount.toString())}
                    </span>
                  </div>
                ) : (
                  <span className="text-red-600 font-medium">{t('outOfStock')}</span>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">{t('description')}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {getProductDescription()}
                </p>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3">{t('features')}</h3>
                <ul className="space-y-2">
                  {getProductFeatures().map((feature: string, index: number) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quantity and Add to Cart */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-medium">{t('quantity')}:</span>
                  <div className="flex items-center border rounded-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="px-4 py-2 min-w-[3rem] text-center">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
                      disabled={quantity >= product.stockCount}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    className="flex-1"
                    size="lg"
                    disabled={!product.inStock || isLoading}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {isLoading ? t('adding') : t('addToCart')}
                  </Button>
                  <Button variant="outline" size="lg">
                    <Heart className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="lg">
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Service Features */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t">
                <div className="text-center">
                  <Truck className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">{t('freeShipping')}</p>
                </div>
                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">{t('securePayment')}</p>
                </div>
                <div className="text-center">
                  <RotateCcw className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">{t('easyReturns')}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

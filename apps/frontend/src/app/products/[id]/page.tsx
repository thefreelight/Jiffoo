'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ShoppingCart, Minus, Plus, Share2, Truck, Shield, RotateCcw, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { ProductService, Product } from '@/services/product.service';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProductPage({ params }: ProductPageProps) {
  // 使用React.use()解包params Promise
  const resolvedParams = React.use(params);
  const { currentLanguage } = useTranslation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const [product, setProduct] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedImage, setSelectedImage] = React.useState(0);
  const [quantity, setQuantity] = React.useState(1);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      backToProducts: 'Back to Products',
      addToCart: 'Add to Cart',
      addToWishlist: 'Add to Wishlist',
      share: 'Share',
      quantity: 'Quantity',
      inStock: 'In Stock',
      outOfStock: 'Out of Stock',
      features: 'Product Features',
      description: 'Description',
      freeShipping: 'Free Shipping',
      securePayment: 'Secure Payment',
      easyReturns: 'Easy Returns',
      stockLeft: '{count} left in stock',
      adding: 'Adding...',
      addedToCart: 'Added to Cart',
      addedToCartDesc: 'has been added to your cart',
      error: 'Error',
      addToCartError: 'Failed to add item to cart',
      productNotFound: 'Product not found',
      loadingProduct: 'Loading product...',
      retry: 'Retry',
      failedToLoad: 'Failed to load product',
      productId: 'Product ID',
      createdAt: 'Created',
      specifications: 'Specifications',
      pricePerUnit: 'Price per unit',
    },
    'zh-CN': {
      backToProducts: '返回商品列表',
      addToCart: '加入购物车',
      addToWishlist: '加入收藏',
      share: '分享',
      quantity: '数量',
      inStock: '有库存',
      outOfStock: '缺货',
      features: '商品特性',
      description: '商品描述',
      freeShipping: '免费配送',
      securePayment: '安全支付',
      easyReturns: '轻松退货',
      stockLeft: '库存剩余 {count} 件',
      adding: '添加中...',
      addedToCart: '已加入购物车',
      addedToCartDesc: '已添加到您的购物车',
      error: '错误',
      addToCartError: '添加商品到购物车失败',
      productNotFound: '商品未找到',
      loadingProduct: '加载商品中...',
      retry: '重试',
      failedToLoad: '加载商品失败',
      productId: '商品编号',
      createdAt: '创建时间',
      specifications: '规格参数',
      pricePerUnit: '单价',
    },
    'ja-JP': {
      backToProducts: '商品一覧に戻る',
      addToCart: 'カートに追加',
      addToWishlist: 'ウィッシュリストに追加',
      share: '共有',
      quantity: '数量',
      inStock: '在庫あり',
      outOfStock: '在庫切れ',
      features: '商品特徴',
      description: '商品説明',
      freeShipping: '送料無料',
      securePayment: '安全な支払い',
      easyReturns: '簡単返品',
      stockLeft: '在庫残り{count}個',
      adding: '追加中...',
      addedToCart: 'カートに追加しました',
      addedToCartDesc: 'がカートに追加されました',
      error: 'エラー',
      addToCartError: 'カートへの追加に失敗しました',
      productNotFound: '商品が見つかりません',
      loadingProduct: '商品を読み込み中...',
      retry: '再試行',
      failedToLoad: '商品の読み込みに失敗しました',
      productId: '商品ID',
      createdAt: '作成日',
      specifications: '仕様',
      pricePerUnit: '単価',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  // 加载商品数据
  React.useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await ProductService.getProductById(resolvedParams.id);
        setProduct(response.product);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
        console.error('Failed to load product:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [resolvedParams.id]);

  const handleAddToCart = async () => {
    if (!product) return;
    
    try {
      setIsAddingToCart(true);
      await addToCart(product.id, quantity);

      toast({
        title: t('addedToCart'),
        description: `${product.name} ${t('addedToCartDesc')}`,
      });
    } catch (error) {
      toast({
        title: t('error'),
        description: t('addToCartError'),
        variant: 'destructive',
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: product?.description,
          url: window.location.href,
        });
      } catch (error) {
        // Fallback to copy to clipboard
        navigator.clipboard.writeText(window.location.href);
        toast({
          title: 'Link copied!',
          description: 'Product link copied to clipboard',
        });
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      // Fallback to copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied!',
        description: 'Product link copied to clipboard',
      });
    }
  };

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2 text-lg">{t('loadingProduct')}</span>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-red-500 mb-4">
              {error || t('productNotFound')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t('failedToLoad')}
            </p>
            <div className="space-x-4">
              <Button onClick={() => window.location.reload()}>
                {t('retry')}
              </Button>
              <Link href="/products">
                <Button variant="outline">
                  {t('backToProducts')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 生成商品图片数组（如果只有一张图片，重复使用）
  const productImages = product.images ? [product.images] : ['/placeholder-product.jpg'];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* 面包屑导航 */}
        <div className="mb-8">
          <Link
            href="/products"
            className="flex items-center text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToProducts')}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* 商品图片 */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="aspect-square overflow-hidden rounded-xl bg-muted"
            >
              <Image
                src={productImages[selectedImage] || '/placeholder-product.jpg'}
                alt={product.name}
                width={600}
                height={600}
                className="w-full h-full object-cover"
                priority
              />
            </motion.div>

            {/* 缩略图 */}
            {productImages.length > 1 && (
              <div className="flex gap-4">
                {productImages.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square w-20 overflow-hidden rounded-lg border-2 transition-colors ${
                      selectedImage === index ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 商品信息 */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* 商品名称 */}
              <h1 className="text-3xl lg:text-4xl font-bold mb-4">
                {product.name}
              </h1>

              {/* 价格 */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl font-bold text-primary">${product.price}</span>
                <span className="text-sm text-muted-foreground">
                  {t('pricePerUnit')}
                </span>
              </div>

              {/* 库存状态 */}
              <div className="mb-6">
                {product.stock > 0 ? (
                  <div className="text-green-600">
                    <span className="font-medium">{t('inStock')}</span>
                    <span className="text-sm ml-2">
                      {t('stockLeft').replace('{count}', product.stock.toString())}
                    </span>
                  </div>
                ) : (
                  <span className="text-red-600 font-medium">{t('outOfStock')}</span>
                )}
              </div>

              {/* 商品描述 */}
              {product.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{t('description')}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}

              {/* 规格参数 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3">{t('specifications')}</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{t('productId')}:</span>
                    <span className="text-muted-foreground">{product.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">{t('createdAt')}:</span>
                    <span className="text-muted-foreground">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Stock:</span>
                    <span className="text-muted-foreground">{product.stock} units</span>
                  </div>
                </div>
              </div>

              {/* 数量选择和加入购物车 */}
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
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    className="flex-1"
                    size="lg"
                    disabled={product.stock === 0 || isAddingToCart}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {isAddingToCart ? t('adding') : t('addToCart')}
                  </Button>
                  <Button variant="outline" size="lg">
                    <Heart className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleShare}>
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* 服务特性 */}
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

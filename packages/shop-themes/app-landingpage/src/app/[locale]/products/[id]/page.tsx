'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { productsApi, cartApi, authApi, type Product } from '../../../../lib/api';
import {
  parseESimVariantAttributes,
  getDataDisplayText,
  getValidityDisplayText,
  getNetworkDisplayText,
} from '../../../../lib/esim';

// Sample reviews (in a real app, these would come from an API)
const sampleReviews = [
  {
    id: '1',
    name: 'James Wilson',
    image: 'https://randomuser.me/api/portraits/men/32.jpg',
    rating: 5,
    date: '2 days ago',
    text: "This eSIM was a lifesaver during my trip! The setup was incredibly easy, and I had internet access as soon as I landed. The connection was fast and reliable throughout my entire trip. Highly recommend!",
  },
  {
    id: '2',
    name: 'Emma Thompson',
    image: 'https://randomuser.me/api/portraits/women/44.jpg',
    rating: 5,
    date: '1 week ago',
    text: "Perfect for my vacation. The data was more than enough for maps, social media, and even some video streaming. The setup process was straightforward and I didn't need to visit any stores. Will definitely use TravelPass again!",
  },
  {
    id: '3',
    name: 'David Chen',
    image: 'https://randomuser.me/api/portraits/men/75.jpg',
    rating: 4,
    date: '2 weeks ago',
    text: "Great coverage and speeds throughout most of my trip. I traveled extensively and had consistent service. The only minor issue was slightly weaker signal in some remote areas, but that's to be expected. Would buy again.",
  },
];

// Helper to get product image
const getProductImage = (product: Product): string => {
  if (!product.images || product.images.length === 0) {
    return 'https://images.unsplash.com/photo-1480796927426-f609979314bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80';
  }
  const firstImage = product.images[0];
  return typeof firstImage === 'string' ? firstImage : 'https://images.unsplash.com/photo-1480796927426-f609979314bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80';
};

// Helper to get eSIM attributes from variant
const getESimAttributes = (variant: any, locale: 'en' | 'zh-Hant' = 'en'): {
  data: string;
  validity: string;
  network: string;
} | null => {
  if (!variant?.attributes) return null;

  const attrs = parseESimVariantAttributes(variant.attributes);
  if (!attrs) return null;

  return {
    data: getDataDisplayText(attrs.esim.data, locale),
    validity: getValidityDisplayText(attrs.esim.validityDays, locale),
    network: getNetworkDisplayText(attrs.esim.networks),
  };
};

// Key features for eSIM products
const defaultFeatures = [
  'Instant delivery via email after purchase',
  'Easy installation with QR code scanning',
  'Compatible with all eSIM-enabled devices',
  'No need to change your phone number',
  '24/7 customer support via chat and email',
  'Nationwide coverage',
];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Fetch product from Core API
  useEffect(() => {
    async function fetchProduct() {
      if (!productId) return;

      setIsLoading(true);
      setError(null);
      try {
        const productData = await productsApi.getProduct(productId, locale);
        setProduct(productData);

        // Set initial variant
        if (productData.variants && productData.variants.length > 0) {
          setSelectedVariant(productData.variants[0].id);
        }

        // Fetch related products
        try {
          const related = await productsApi.getProducts(1, 4, {}, locale);
          setRelatedProducts(related.items.filter((p) => p.id !== productId).slice(0, 4));
        } catch {
          // Ignore related products error
        }
      } catch (err) {
        console.error('Failed to fetch product:', err);
        setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProduct();
  }, [productId, locale]);

  // Get current variant price
  const getCurrentPrice = (): number => {
    if (!product) return 0;
    if (selectedVariant && product.variants) {
      const variant = product.variants.find((v) => v.id === selectedVariant);
      if (variant) return variant.basePrice;
    }
    return product.price;
  };

  // Get current stock
  const getCurrentStock = (): number => {
    if (!product) return 0;
    if (selectedVariant && product.variants) {
      const variant = product.variants.find((v) => v.id === selectedVariant);
      if (variant) return variant.baseStock;
    }
    return product.stock;
  };

  // Get current variant's eSIM attributes
  const currentVariantData = useMemo(() => {
    if (!product || !product.variants || !selectedVariant) return null;
    const variant = product.variants.find((v) => v.id === selectedVariant);
    if (!variant) return null;
    return getESimAttributes(variant, locale as 'en' | 'zh-Hant');
  }, [product, selectedVariant, locale]);

  const handleBuyNow = async () => {
    if (!product) return;

    if (!authApi.isAuthenticated()) {
      router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setIsAddingToCart(true);
    try {
      await cartApi.addToCart(product.id, quantity, selectedVariant);
      router.push(`/${locale}/checkout`);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    if (!authApi.isAuthenticated()) {
      router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setIsAddingToCart(true);
    try {
      await cartApi.addToCart(product.id, quantity, selectedVariant);
      router.push(`/${locale}/cart`);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleViewRelatedProduct = (id: string) => {
    router.push(`/${locale}/products/${id}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gray-100 py-2">
          <div className="container mx-auto px-4">
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
        </div>
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-2/3">
                <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                  <div className="h-96 bg-gray-200"></div>
                  <div className="p-6 space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/3">
                <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-24 mb-4"></div>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                  <div className="h-12 bg-gray-200 rounded mt-6"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <i className="fas fa-exclamation-circle text-6xl text-gray-300 mb-4"></i>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Product not found'}
          </h1>
          <button
            onClick={() => router.push(`/${locale}/products`)}
            className="text-blue-600 hover:underline"
          >
            <i className="fas fa-arrow-left mr-2"></i> Back to Products
          </button>
        </div>
      </div>
    );
  }

  const currentPrice = getCurrentPrice();
  const currentStock = getCurrentStock();
  const isOutOfStock = currentStock <= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <button onClick={() => router.push(`/${locale}/products`)} className="text-gray-500 hover:text-blue-600">eSIM Packages</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Detail */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Product Image and Info */}
            <div className="lg:w-2/3">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Image */}
                <div className="relative h-96">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1480796927426-f609979314bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80';
                    }}
                  />
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">Out of Stock</span>
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
                  </div>

                  <p className="text-gray-600 mb-6">{product.description || 'Stay connected throughout your journey with our reliable eSIM plan. Perfect for tourists and business travelers who need dependable internet access without the hassle of physical SIM cards.'}</p>

                  {currentVariantData && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center mb-2">
                          <i className="fas fa-wifi text-blue-600 mr-2"></i>
                          <span className="font-medium">Data</span>
                        </div>
                        <p>{currentVariantData.data}</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center mb-2">
                          <i className="fas fa-calendar-alt text-blue-600 mr-2"></i>
                          <span className="font-medium">Validity</span>
                        </div>
                        <p>{currentVariantData.validity}</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center mb-2">
                          <i className="fas fa-signal text-blue-600 mr-2"></i>
                          <span className="font-medium">Network</span>
                        </div>
                        <p>{currentVariantData.network}</p>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-semibold mb-4">Key Features</h2>

                  <ul className="space-y-3 mb-6">
                    {defaultFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <i className="fas fa-check-circle text-green-500 mt-1 mr-2"></i>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <h2 className="text-xl font-semibold mb-4">Description</h2>

                  <div className="space-y-4 text-gray-600">
                    <p>{product.description || 'Our eSIM is the perfect solution for travelers who need reliable internet connectivity without the hassle of changing physical SIM cards or dealing with rental counters.'}</p>
                    <p>After purchasing, you'll receive your eSIM QR code instantly via email. Simply scan the QR code with your smartphone, follow the setup instructions, and you'll be connected as soon as you arrive at your destination.</p>
                  </div>
                </div>
              </div>

              {/* Reviews Section - Static Marketing Content */}
              <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Customer Reviews</h2>

                {/* Review Statistics Summary */}
                <div className="flex flex-col md:flex-row md:items-center bg-gray-50 p-6 rounded-lg mb-8">
                  <div className="md:w-1/4 text-center md:border-r md:border-gray-200 md:pr-6 mb-6 md:mb-0">
                    <div className="text-4xl font-bold text-gray-800 mb-1">4.9</div>
                    <div className="flex justify-center text-yellow-400 mb-1">
                      <i className="fas fa-star"></i>
                      <i className="fas fa-star"></i>
                      <i className="fas fa-star"></i>
                      <i className="fas fa-star"></i>
                      <i className="fas fa-star-half-alt"></i>
                    </div>
                    <div className="text-sm text-gray-500">Based on 128 reviews</div>
                  </div>
                  <div className="md:w-3/4 md:pl-6 space-y-2">
                    {[
                      { stars: 5, percentage: 85 },
                      { stars: 4, percentage: 10 },
                      { stars: 3, percentage: 3 },
                      { stars: 2, percentage: 1 },
                      { stars: 1, percentage: 1 },
                    ].map((row) => (
                      <div key={row.stars} className="flex items-center text-sm">
                        <span className="w-12 text-gray-600">{row.stars} stars</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full mx-3">
                          <div
                            className="h-2 bg-yellow-400 rounded-full"
                            style={{ width: `${row.percentage}%` }}
                          ></div>
                        </div>
                        <span className="w-10 text-right text-gray-500">{row.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Individual Reviews - Static testimonials for marketing */}
                <div className="space-y-6">
                  {sampleReviews.map((review, index) => (
                    <div key={review.id} className={index < sampleReviews.length - 1 ? 'border-b border-gray-200 pb-6' : ''}>
                      <div className="flex items-center mb-2">
                        <img src={review.image} alt={review.name} className="w-10 h-10 rounded-full mr-3" />
                        <div>
                          <h4 className="font-medium">{review.name}</h4>
                          <div className="flex text-yellow-400 text-sm">
                            {[...Array(5)].map((_, i) => (
                              <i
                                key={i}
                                className={`fas ${i < review.rating ? 'fa-star' : 'far fa-star'}`}
                              ></i>
                            ))}
                          </div>
                        </div>
                        <div className="ml-auto text-sm text-gray-500">{review.date}</div>
                      </div>
                      <p className="text-gray-600">"{review.text}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Purchase Box */}
            <div className="lg:w-1/3">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-gray-800">${currentPrice.toFixed(2)}</span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${isOutOfStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">Taxes included</p>
                </div>

                {/* Variant Options */}
                {product.variants && product.variants.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-medium mb-3">Choose Your Plan</h3>
                    <div className="space-y-2">
                      {product.variants.map((variant) => (
                        <label
                          key={variant.id}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition ${selectedVariant === variant.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-500'
                            } ${(!variant.isActive || variant.baseStock <= 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="variant"
                              checked={selectedVariant === variant.id}
                              onChange={() => setSelectedVariant(variant.id)}
                              disabled={!variant.isActive || variant.baseStock <= 0}
                              className="text-blue-600 focus:ring-blue-500 h-4 w-4 mr-3"
                            />
                            <div>
                              <span className="block font-medium">{variant.name}</span>
                              {variant.baseStock <= 0 && (
                                <span className="text-sm text-red-500">Out of Stock</span>
                              )}
                            </div>
                          </div>
                          <span className="font-medium">${variant.basePrice.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Quantity</h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      -
                    </button>
                    <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                      disabled={quantity >= currentStock || isOutOfStock}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={handleBuyNow}
                  disabled={isOutOfStock || isAddingToCart}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-medium py-3 px-4 rounded-md transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingToCart ? 'Processing...' : isOutOfStock ? 'Out of Stock' : 'Buy Now'}
                </button>

                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || isAddingToCart}
                  className="block w-full border border-blue-600 text-blue-600 hover:bg-blue-50 text-center font-medium py-3 px-4 rounded-md transition mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingToCart ? 'Adding...' : 'Add to Cart'}
                </button>

                {/* Secure Transaction and Delivery Info */}
                <div className="space-y-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <i className="fas fa-shield-alt text-green-600 w-5"></i>
                    <span>Secure transaction</span>
                  </div>

                  <div className="flex items-center text-gray-600">
                    <i className="fas fa-envelope text-blue-600 w-5"></i>
                    <span>Instant delivery via email</span>
                  </div>

                  <div className="flex items-center text-gray-600">
                    <i className="fas fa-undo text-blue-600 w-5"></i>
                    <span>7-day refund policy if not activated</span>
                  </div>
                </div>

                {/* Need Help Box */}
                <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Need Help?</h3>
                  <p className="text-sm text-gray-600 mb-3">Our support team is available 24/7 to assist you with any questions.</p>
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                    <i className="fas fa-comment-dots mr-2"></i> Chat with Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8">You May Also Like</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => {
                // Get first variant's eSIM data for related products
                const firstVariant = relatedProduct.variants?.[0];
                const relatedData = firstVariant ? getESimAttributes(firstVariant, locale as 'en' | 'zh-Hant') : null;

                return (
                  <div
                    key={relatedProduct.id}
                    className="card group cursor-pointer"
                    onClick={() => handleViewRelatedProduct(relatedProduct.id)}
                  >
                    <div className="relative">
                      <img
                        src={getProductImage(relatedProduct)}
                        alt={relatedProduct.name}
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">{relatedProduct.name}</h3>
                      </div>
                      {relatedData && (
                        <div className="mb-4 text-gray-600">
                          <p>{relatedData.data} • {relatedData.validity}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-gray-800">${relatedProduct.price.toFixed(2)}</span>
                        <button className="text-blue-600 hover:text-blue-800">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

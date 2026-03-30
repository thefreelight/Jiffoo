/**
 * Product Detail Page - TravelPass Design
 * eSIM package detail with reviews, trust badges, and plan selection.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { ProductDetailPageProps } from '../types';

export const ProductDetailPage = React.memo(function ProductDetailPage({
  product,
  isLoading,
  selectedVariant,
  quantity,
  config,
  onVariantChange,
  onQuantityChange,
  onAddToCart,
  onBack,
}: ProductDetailPageProps) {
  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  // Product not found
  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-blue-400 text-5xl mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Product Not Found</h2>
          <p className="text-gray-500 mb-6">The eSIM package you are looking for does not exist.</p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-arrow-left" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Handle both inventory object and direct stock field
  const stockValue = product.inventory?.available ?? (product as any).stock ?? 0;
  const isOutOfStock = product.inventory?.isInStock === false || stockValue <= 0;
  const maxQuantity = Math.min(stockValue, 10);

  // Handle both image object array and string array formats
  const getMainImage = () => {
    if (!product.images || product.images.length === 0) {
      return '/placeholder-product.svg';
    }
    const firstImage = product.images[0];
    if (typeof firstImage === 'string') {
      return firstImage;
    }
    const mainImg = product.images.find((img: any) => img.isMain);
    return mainImg?.url || (firstImage as any).url || '/placeholder-product.svg';
  };
  const mainImage = getMainImage();

  const discountPercent =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;

  // Find the selected variant object for price display
  const activeVariant = product.variants?.find((v) => v.id === selectedVariant);

  // Sample reviews data
  const sampleReviews = [
    {
      id: 1,
      name: 'James Wilson',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      rating: 5,
      time: '2 days ago',
      text: 'This eSIM was a lifesaver during my trip to Tokyo! The setup was incredibly easy, and I had internet access as soon as I landed. The connection was fast and reliable throughout my entire trip, even in rural areas. Highly recommend!',
    },
    {
      id: 2,
      name: 'Emma Thompson',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      rating: 5,
      time: '1 week ago',
      text: 'Perfect for my 10-day vacation in Japan. The 5GB was more than enough for maps, social media, and even some video streaming. The setup process was straightforward and I didn\'t need to visit any stores. Will definitely use TravelPass again for my next trip!',
    },
    {
      id: 3,
      name: 'David Chen',
      avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
      rating: 4,
      time: '2 weeks ago',
      text: 'Great coverage and speeds throughout most of Japan. I traveled from Tokyo to Osaka and had consistent service. The only minor issue was slightly weaker signal in some subway stations, but that\'s to be expected. The setup was simple and customer service was responsive when I had a question. Would buy again.',
    },
  ];

  const ratingDistribution = [
    { stars: 5, percent: 85 },
    { stars: 4, percent: 10 },
    { stars: 3, percent: 3 },
    { stars: 2, percent: 1 },
    { stars: 1, percent: 1 },
  ];

  const keyFeatures = [
    'Instant delivery via email after purchase',
    'Easy installation with QR code scanning',
    'Compatible with all eSIM-enabled devices',
    'No need to change your phone number',
    '24/7 customer support via chat and email',
    'Nationwide coverage across all of Japan',
  ];

  const planDescriptions: Record<number, string> = {
    0: 'Best for short trips',
    1: 'Best value',
    2: 'For heavy users',
  };

  const rating = product.rating || 4.7;
  const reviewCount = product.reviewCount || 361;

  const renderStars = (ratingValue: number, sizeClass: string = 'text-sm') => {
    const full = Math.floor(ratingValue);
    const half = ratingValue - full >= 0.3 && ratingValue - full < 0.8;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <>
        {Array.from({ length: full }).map((_, i) => (
          <i key={`full-${i}`} className={cn('fas fa-star text-yellow-400', sizeClass)} />
        ))}
        {half && <i className={cn('fas fa-star-half-alt text-yellow-400', sizeClass)} />}
        {Array.from({ length: empty }).map((_, i) => (
          <i key={`empty-${i}`} className={cn('far fa-star text-gray-300', sizeClass)} />
        ))}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-gray-100 pt-20 pb-2">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={onBack} className="hover:text-blue-600 transition-colors">
              Home
            </button>
            <span>/</span>
            <button onClick={onBack} className="hover:text-blue-600 transition-colors">
              eSIM Packages
            </button>
            <span>/</span>
            <span className="text-gray-800 font-medium">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column */}
          <div className="lg:w-2/3">
            {/* Product image card */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="relative">
                <img
                  src={mainImage}
                  alt={product.name}
                  className="w-full h-96 object-cover"
                />
                <span className="absolute top-4 right-4 bg-green-500 rounded-full py-1 px-3 shadow-md">
                  <span className="text-sm font-medium text-white">New</span>
                </span>
              </div>

              <div className="p-6">
                {/* Title + rating */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                  <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
                  <div className="mt-2 md:mt-0">
                    <div className="flex items-center">
                      <div className="flex text-yellow-400 mr-2">
                        {renderStars(rating, 'text-sm')}
                      </div>
                      <span className="text-gray-600">
                        {rating.toFixed(1)} ({reviewCount} reviews)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <i className="fas fa-wifi text-blue-600 mr-2" />
                      <span className="font-medium">Data</span>
                    </div>
                    <p>{activeVariant?.name || '5GB High-Speed Data'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <i className="fas fa-calendar-alt text-blue-600 mr-2" />
                      <span className="font-medium">Validity</span>
                    </div>
                    <p>{activeVariant?.value || '30 Days'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <i className="fas fa-signal text-blue-600 mr-2" />
                      <span className="font-medium">Network</span>
                    </div>
                    <p>4G/5G Coverage</p>
                  </div>
                </div>

                {/* Key Features */}
                <h3 className="text-xl font-semibold mb-4">Key Features</h3>
                <ul className="space-y-3 mb-6">
                  {keyFeatures.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <i className="fas fa-check-circle text-green-500 mt-1 mr-2" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Description */}
                <h2 className="text-xl font-semibold mb-4">Description</h2>
                <div className="space-y-4 text-gray-600">
                  <p>{product.description}</p>
                  <p>
                    Stay connected wherever you go with our premium eSIM service. Enjoy seamless
                    connectivity with high-speed data, easy setup, and reliable coverage across
                    major networks.
                  </p>
                </div>
              </div>
            </div>

            {/* Reviews section */}
            <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
              <h2 className="text-xl font-semibold mb-6">Customer Reviews</h2>

              {/* Overall rating + distribution */}
              <div className="flex flex-col md:flex-row gap-8 mb-8">
                {/* Overall */}
                <div className="flex items-center">
                  <div className="text-5xl font-bold text-gray-800 mr-4">
                    {rating.toFixed(1)}
                  </div>
                  <div>
                    <div className="flex text-yellow-400 mb-1">
                      {renderStars(rating, 'text-sm')}
                    </div>
                    <p className="text-gray-600">
                      Based on {reviewCount} reviews
                    </p>
                  </div>
                </div>

                {/* Distribution bars */}
                <div className="flex-1 space-y-2">
                  {ratingDistribution.map((item) => (
                    <div key={item.stars} className="flex items-center">
                      <span className="text-sm w-16">
                        {item.stars} {item.stars === 1 ? 'star' : 'stars'}
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden mx-2">
                        <div
                          className="h-full rounded-full bg-yellow-400"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-12 text-right">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review cards */}
              <div className="space-y-6">
                {sampleReviews.map((review, reviewIndex) => (
                  <div
                    key={review.id}
                    className={reviewIndex < sampleReviews.length - 1 ? 'border-b border-gray-200 pb-6' : undefined}
                  >
                    <div className="flex items-center mb-2">
                      <img
                        src={review.avatar}
                        alt={review.name}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div>
                        <div className="font-medium">{review.name}</div>
                        <div className="flex text-yellow-400 text-sm">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <i
                              key={i}
                              className={i < review.rating ? 'fas fa-star' : 'far fa-star'}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="ml-auto text-sm text-gray-500">{review.time}</span>
                    </div>
                    <p className="text-gray-600">{review.text}</p>
                  </div>
                ))}
              </div>

              {/* See All Reviews */}
              <div className="mt-6 text-center">
                <button className="text-blue-600 hover:text-blue-800 font-medium">
                  See All 287 Reviews <i className="fas fa-chevron-right ml-1" />
                </button>
              </div>
            </div>
          </div>

          {/* Right column (sticky sidebar) */}
          <div className="lg:w-1/3">
              {/* Purchase card */}
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                {/* Price + Stock badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold text-gray-800">
                      ${activeVariant?.price ?? product.price}
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-base text-gray-400 line-through">
                        ${product.originalPrice}
                      </span>
                    )}
                  </div>
                  {isOutOfStock ? (
                    <span className="inline-block bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      Out of Stock
                    </span>
                  ) : (
                    <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      In Stock
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm mb-4">Taxes included</p>

                {/* Plan selection */}
                {product.variants && product.variants.length > 0 && (
                  <div className="mb-5">
                    <h3 className="font-medium mb-3">Choose Your Plan</h3>
                    <div className="space-y-2">
                      {product.variants.map((variant, index) => (
                        <label
                          key={variant.id}
                          className={cn(
                            'flex items-center justify-between border rounded-lg p-3 cursor-pointer transition-colors',
                            selectedVariant === variant.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-500'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="variant"
                              checked={selectedVariant === variant.id}
                              onChange={() => onVariantChange(variant.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {variant.name || variant.value}
                              </span>
                              {planDescriptions[index] && (
                                <p className="text-xs text-gray-500">{planDescriptions[index]}</p>
                              )}
                            </div>
                          </div>
                          {variant.price !== undefined && (
                            <span className="text-sm font-semibold text-gray-900">
                              ${variant.price}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity selector */}
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm">Quantity</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="fas fa-minus text-xs text-gray-600" />
                    </button>
                    <span className="text-lg font-semibold w-10 text-center text-gray-900">
                      {quantity}
                    </span>
                    <button
                      onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
                      disabled={quantity >= maxQuantity}
                      className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="fas fa-plus text-xs text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Buy Now button */}
                <button
                  onClick={() => onAddToCart?.()}
                  disabled={isOutOfStock}
                  className={cn(
                    'w-full py-3 rounded-md font-semibold text-white transition-colors mb-3',
                    isOutOfStock
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
                </button>

                {/* Add to Cart button */}
                <button
                  onClick={() => onAddToCart?.()}
                  disabled={isOutOfStock}
                  className={cn(
                    'w-full py-3 rounded-md font-semibold transition-colors mb-6',
                    isOutOfStock
                      ? 'border border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border border-blue-600 text-blue-600 hover:bg-blue-50'
                  )}
                >
                  Add to Cart
                </button>

                {/* Trust badges */}
                <div className="pt-5 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <i className="fas fa-shield-alt text-green-600 w-5 text-center" />
                    <span>Secure transaction</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <i className="fas fa-envelope text-blue-600 w-5 text-center" />
                    <span>Instant delivery via email</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <i className="fas fa-undo text-blue-600 w-5 text-center" />
                    <span>7-day refund policy if not activated</span>
                  </div>
                </div>

                {/* Need Help box */}
                <div className="bg-gray-50 p-4 rounded-lg mt-6">
                  <h3 className="font-medium mb-2">Need Help?</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Our support team is available 24/7 to assist you with any questions.
                  </p>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <i className="fas fa-comment-dots" />
                    Chat with Support
                  </a>
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* You May Also Like */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-8">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'South Korea 5GB', price: 21.99, rating: 4.7, desc: '5GB Data \u2022 14 Days \u2022 4G/5G', img: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400&h=200&fit=crop' },
              { name: 'China 8GB', price: 29.99, rating: 4.6, desc: '8GB Data \u2022 30 Days \u2022 4G/5G', img: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f04?w=400&h=200&fit=crop' },
              { name: 'Taiwan 3GB', price: 18.99, rating: 4.8, desc: '3GB Data \u2022 14 Days \u2022 4G/5G', img: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=200&fit=crop' },
              { name: 'Asia 10GB', price: 39.99, rating: 4.9, badge: 'Best Seller', desc: '10GB Data \u2022 30 Days \u2022 4G/5G', img: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=400&h=200&fit=crop' },
            ].map((item) => (
              <div key={item.name} className="bg-white rounded-lg shadow-sm overflow-hidden hover:-translate-y-[3px] hover:shadow-md transition-all duration-200">
                <img src={item.img} alt={item.name} className="w-full h-40 object-cover" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                    <div className="flex items-center">
                      <i className="fas fa-star text-yellow-400" />
                      <span className="ml-1 text-gray-600">{item.rating}</span>
                    </div>
                  </div>
                  <div className="mb-4 text-gray-600"><p>{item.desc}</p></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-gray-800">${item.price}</span>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); onBack(); }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View Details
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
});

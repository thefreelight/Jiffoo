'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { productsApi, cartApi, authApi, type Product } from '../../../lib/api';
import {
  parseESimVariantAttributes,
  getDataDisplayText,
  getValidityDisplayText,
} from '../../../lib/esim';

// Filter options for eSIM packages
const regions = ['North America', 'Europe', 'Asia', 'South America', 'Africa', 'Oceania', 'Middle East'];
const dataAmounts = ['1GB - 3GB', '5GB - 10GB', '15GB - 20GB', '30GB+', 'Unlimited'];
const validityPeriods = ['7 days', '14 days', '30 days', '60 days', '90 days'];

// Helper to get product image
const getProductImage = (product: Product): string => {
  if (!product.images || product.images.length === 0) {
    return 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  }
  const firstImage = product.images[0];
  return typeof firstImage === 'string' ? firstImage : 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
};

// Helper to get eSIM data from product's first variant
const getProductESimData = (product: Product, locale: 'en' | 'zh-Hant' = 'en') => {
  if (!product.variants || product.variants.length === 0) return null;

  const variant = product.variants[0];
  if (!variant?.attributes) return null;

  const attrs = parseESimVariantAttributes(variant.attributes);
  if (!attrs) return null;

  return {
    data: getDataDisplayText(attrs.esim.data, locale),
    validity: getValidityDisplayText(attrs.esim.validityDays, locale),
    tags: attrs.esim.tags || [],
    badge: attrs.esim.marketing?.badge,
    badgeColor: attrs.esim.marketing?.badgeColor,
  };
};

export default function ProductsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('price-low');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedDataAmounts, setSelectedDataAmounts] = useState<string[]>([]);
  const [selectedValidityPeriods, setSelectedValidityPeriods] = useState<string[]>([]);

  // Fetch products from Core API
  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await productsApi.getProducts(currentPage, 12, {}, locale);
        setProducts(response.items);
        setTotalPages(response.totalPages);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, [currentPage, locale]);

  const handleViewProduct = (id: string) => {
    router.push(`/${locale}/products/${id}`);
  };

  const handleAddToCart = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!authApi.isAuthenticated()) {
      router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setAddingToCart(productId);
    try {
      await cartApi.addToCart(productId, 1);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAddingToCart(null);
    }
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const toggleDataAmount = (amount: string) => {
    setSelectedDataAmounts((prev) =>
      prev.includes(amount) ? prev.filter((a) => a !== amount) : [...prev, amount]
    );
  };

  const toggleValidityPeriod = (period: string) => {
    setSelectedValidityPeriods((prev) =>
      prev.includes(period) ? prev.filter((p) => p !== period) : [...prev, period]
    );
  };

  const clearFilters = () => {
    setSelectedRegions([]);
    setSelectedDataAmounts([]);
    setSelectedValidityPeriods([]);
    setSearchQuery('');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <section className="bg-blue-600 py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold text-white text-center">eSIM Travel Packages</h1>
            <p className="text-center text-white/90 mt-2">Browse our selection of affordable travel packages for destinations worldwide</p>
          </div>
        </section>
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/4">
                <div className="bg-white p-6 rounded-lg shadow-sm animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-32 mb-6"></div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="mb-6">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                      <div className="space-y-2">
                        {[...Array(3)].map((_, j) => (
                          <div key={j} className="h-4 bg-gray-200 rounded w-full"></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:w-3/4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                      <div className="h-40 bg-gray-200"></div>
                      <div className="p-5">
                        <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                        <div className="space-y-2 mb-4">
                          {[...Array(3)].map((_, j) => (
                            <div key={j} className="h-4 bg-gray-200 rounded w-full"></div>
                          ))}
                        </div>
                        <div className="flex justify-between">
                          <div className="h-6 bg-gray-200 rounded w-20"></div>
                          <div className="h-10 bg-gray-200 rounded w-24"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <section className="bg-blue-600 py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold text-white text-center">eSIM Travel Packages</h1>
          </div>
        </section>
        <section className="py-12">
          <div className="container mx-auto px-4 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <section className="bg-blue-600 py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-white text-center">eSIM Travel Packages</h1>
          <p className="text-center text-white/90 mt-2">Browse our selection of affordable travel packages for destinations worldwide</p>
        </div>
      </section>

      {/* Filter and Product List */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/4">
              <div className="bg-white p-6 rounded-lg shadow-sm sticky top-24">
                <h2 className="text-xl font-semibold mb-6">Filter Options</h2>

                <div className="mb-6">
                  <h3 className="font-medium mb-3">Region</h3>
                  <div className="space-y-2">
                    {regions.map((region) => (
                      <label key={region} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(region)}
                          onChange={() => toggleRegion(region)}
                          className="form-checkbox rounded text-blue-600 mr-2"
                        />
                        <span>{region}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium mb-3">Data Amount</h3>
                  <div className="space-y-2">
                    {dataAmounts.map((amount) => (
                      <label key={amount} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDataAmounts.includes(amount)}
                          onChange={() => toggleDataAmount(amount)}
                          className="form-checkbox rounded text-blue-600 mr-2"
                        />
                        <span>{amount}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium mb-3">Validity Period</h3>
                  <div className="space-y-2">
                    {validityPeriods.map((period) => (
                      <label key={period} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedValidityPeriods.includes(period)}
                          onChange={() => toggleValidityPeriod(period)}
                          className="form-checkbox rounded text-blue-600 mr-2"
                        />
                        <span>{period}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium mb-3">Price Range</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">$0</span>
                      <span className="text-sm text-gray-600">$100</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex space-x-4">
                      <div className="flex-1">
                        <label className="text-sm text-gray-600">Min</label>
                        <input
                          type="number"
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="$0"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm text-gray-600">Max</label>
                        <input
                          type="number"
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="$100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition"
                >
                  Apply Filters
                </button>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full text-gray-600 hover:text-blue-600 font-medium py-2 px-4 mt-2 rounded-md transition"
                >
                  Clear All Filters
                </button>
              </div>
            </div>

            {/* Product Listings */}
            <div className="lg:w-3/4">
              {/* Sort and Search Options */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center">
                  <span className="text-gray-600 mr-2">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="data-high">Data Amount: High to Low</option>
                    <option value="popular">Most Popular</option>
                    <option value="rating">Best Rated</option>
                  </select>
                </div>
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search packages..."
                    className="w-full border border-gray-300 rounded-md py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-search text-gray-400"></i>
                  </div>
                </div>
              </div>

              {/* Empty State */}
              {products.length === 0 ? (
                <div className="text-center py-20">
                  <i className="fas fa-box-open text-6xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500 text-lg">No packages available</p>
                  <p className="text-gray-400 mt-2">Check back later for new eSIM packages</p>
                </div>
              ) : (
                <>
                  {/* Product Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => {
                      const esimData = getProductESimData(product, locale as 'en' | 'zh-Hant');
                      return (
                        <div
                          key={product.id}
                          className="card group cursor-pointer"
                          onClick={() => handleViewProduct(product.id)}
                        >
                          <div className="relative">
                            <img
                              src={getProductImage(product)}
                              alt={product.name}
                              className="w-full h-40 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
                              }}
                            />
                            {esimData?.badge && (
                              <div className={`absolute top-3 right-3 rounded-full py-1 px-3 shadow-md ${esimData.badgeColor === 'green' ? 'bg-green-500' :
                                esimData.badgeColor === 'yellow' ? 'bg-yellow-500' :
                                  esimData.badgeColor === 'red' ? 'bg-red-500' :
                                    'bg-blue-500'
                                }`}>
                                <span className="text-sm font-medium text-white">{esimData.badge}</span>
                              </div>
                            )}
                            {product.stock <= 0 && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-white font-semibold">Out of Stock</span>
                              </div>
                            )}
                          </div>
                          <div className="p-5">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">{product.name}</h3>
                            </div>
                            {esimData && (
                              <div className="space-y-3 mb-4">
                                <div className="flex items-center text-gray-600">
                                  <i className="fas fa-wifi w-5 text-blue-600"></i>
                                  <span>{esimData.data}</span>
                                </div>
                                <div className="flex items-center text-gray-600">
                                  <i className="fas fa-calendar-alt w-5 text-blue-600"></i>
                                  <span>{esimData.validity}</span>
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-xl font-bold text-gray-800">${product.price.toFixed(2)}</span>
                              </div>
                              <button
                                onClick={(e) => handleAddToCart(product.id, e)}
                                disabled={addingToCart === product.id || product.stock <= 0}
                                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {addingToCart === product.id ? 'Adding...' : 'Add to Cart'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center mt-8">
                      <nav>
                        <ul className="flex items-center">
                          <li>
                            <button
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                            >
                              <i className="fas fa-chevron-left"></i>
                            </button>
                          </li>
                          {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                            const page = i + 1;
                            return (
                              <li key={page}>
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`flex items-center justify-center px-3 h-8 leading-tight border border-gray-300 ${currentPage === page
                                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700'
                                    : 'text-gray-500 bg-white hover:bg-gray-100 hover:text-gray-700'
                                    }`}
                                >
                                  {page}
                                </button>
                              </li>
                            );
                          })}
                          <li>
                            <button
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                            >
                              <i className="fas fa-chevron-right"></i>
                            </button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-12 bg-blue-600">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Get the Best Deals First</h2>
            <p className="text-white/90 mb-6">Subscribe to our newsletter to receive exclusive offers and the latest updates on new eSIM packages.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <input
                type="email"
                placeholder="Your email address"
                className="px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 flex-grow max-w-md"
              />
              <button
                type="button"
                className="px-6 py-3 bg-white text-blue-600 font-medium rounded-md hover:bg-gray-100 transition"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

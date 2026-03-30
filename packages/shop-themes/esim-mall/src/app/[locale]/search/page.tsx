'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { productsApi, type Product } from '../../../lib/api';

export default function SearchPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(query);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        const response = await productsApi.getProducts(1, 20, {}, locale);
        // Filter products by search query (client-side for demo)
        const filtered = query
          ? response.items.filter(
              (p) =>
                p.name.toLowerCase().includes(query.toLowerCase()) ||
                p.description?.toLowerCase().includes(query.toLowerCase())
            )
          : response.items;
        setProducts(filtered);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, [query, locale]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/${locale}/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleViewProduct = (id: string) => {
    router.push(`/${locale}/products/${id}`);
  };

  const getProductImage = (product: Product): string => {
    if (!product.images || product.images.length === 0) {
      return 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    }
    const firstImage = product.images[0];
    return typeof firstImage === 'string' ? firstImage : 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">Search</span>
          </nav>
        </div>
      </div>

      {/* Search Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-8">Search Results</h1>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex max-w-2xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for eSIM packages..."
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-search text-gray-400"></i>
                </div>
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-r-md transition font-medium"
              >
                Search
              </button>
            </div>
          </form>

          {query && (
            <p className="text-gray-600 mb-6">
              {isLoading ? 'Searching...' : `${products.length} results for "${query}"`}
            </p>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                  <div className="h-40 bg-gray-200"></div>
                  <div className="p-5">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <i className="fas fa-search text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No results found</p>
              <p className="text-gray-400 mt-2">Try searching with different keywords</p>
              <button
                onClick={() => router.push(`/${locale}/products`)}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition"
              >
                Browse All Packages
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
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
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-1">{product.name}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-gray-800">${product.price.toFixed(2)}</span>
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * TravelPass Products Page Component
 * 
 * SDK-compliant component accepting ProductsPageProps from theme.ts
 * Uses products prop and onAddToCart, onProductClick callbacks
 */

import type { ProductsPageProps } from '../../../../shared/src/types/theme';
import type { Product } from '../../../../shared/src/types/product';

// Helper for translations with fallback
const getText = (t: ProductsPageProps['t'], key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
};

// Filter Sidebar
function FilterSidebar({ t }: Pick<ProductsPageProps, 't'>) {
    const regions = ['North America', 'Europe', 'Asia', 'South America', 'Middle East'];
    const dataAmounts = ['1GB - 3GB', '5GB - 10GB', '15GB+', 'Unlimited'];
    const validityPeriods = ['7 days', '14 days', '30 days', '60 days'];

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm sticky top-4">
            <h2 className="text-xl font-semibold mb-6">{getText(t, 'shop.products.filter.title', 'Filter Options')}</h2>

            <div className="mb-6">
                <h3 className="font-medium mb-3">{getText(t, 'shop.products.filter.region', 'Region')}</h3>
                <div className="space-y-2">
                    {regions.map((region) => (
                        <label key={region} className="flex items-center">
                            <input type="checkbox" className="rounded text-blue-600 mr-2" />
                            <span className="text-sm">{region}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-medium mb-3">{getText(t, 'shop.products.filter.data', 'Data Amount')}</h3>
                <div className="space-y-2">
                    {dataAmounts.map((amount) => (
                        <label key={amount} className="flex items-center">
                            <input type="checkbox" className="rounded text-blue-600 mr-2" />
                            <span className="text-sm">{amount}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-medium mb-3">{getText(t, 'shop.products.filter.validity', 'Validity')}</h3>
                <div className="space-y-2">
                    {validityPeriods.map((period) => (
                        <label key={period} className="flex items-center">
                            <input type="checkbox" className="rounded text-blue-600 mr-2" />
                            <span className="text-sm">{period}</span>
                        </label>
                    ))}
                </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition">
                {getText(t, 'shop.products.filter.apply', 'Apply Filters')}
            </button>
        </div>
    );
}

// Product Card Component
interface ProductCardProps {
    product: Product;
    onAddToCart: (productId: string) => Promise<void>;
    onProductClick: (productId: string) => void;
    t?: ProductsPageProps['t'];
}

function ProductCard({ product, onAddToCart, onProductClick, t }: ProductCardProps) {
    // ProductImage is an object with url property
    const imageUrl = product.images?.[0]?.url || 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=400&q=80';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    const discountPercent = hasDiscount ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden group hover:shadow-lg transition-shadow">
            <div className="relative cursor-pointer" onClick={() => onProductClick(product.id)}>
                <img src={imageUrl} alt={product.name} className="w-full h-40 object-cover" />
                {hasDiscount && (
                    <div className="absolute top-3 right-3 bg-yellow-500 rounded-full py-1 px-3 shadow-md">
                        <span className="text-sm font-medium text-white">-{discountPercent}%</span>
                    </div>
                )}
            </div>
            <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">{product.name}</h3>
                    {product.rating && (
                        <span className="text-gray-600 text-sm">⭐ {product.rating.toFixed(1)}</span>
                    )}
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                <div className="flex justify-between items-center">
                    <div>
                        <span className="text-xl font-bold text-gray-800">${product.price.toFixed(2)}</span>
                        {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-sm text-gray-500 line-through ml-2">${product.originalPrice.toFixed(2)}</span>
                        )}
                    </div>
                    <button
                        onClick={() => onAddToCart(product.id)}
                        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition"
                    >
                        {getText(t, 'shop.products.addToCart', 'Add to Cart')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Loading Skeleton
function ProductSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
            <div className="bg-gray-200 h-40 w-full"></div>
            <div className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                <div className="flex justify-between items-center">
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                </div>
            </div>
        </div>
    );
}

// Main Products Page
export function ProductsPage({
    products,
    isLoading,
    totalProducts,
    currentPage,
    totalPages,
    sortBy,
    viewMode,
    config,
    onSortChange,
    onViewModeChange,
    onPageChange,
    onAddToCart,
    onProductClick,
    t,
}: ProductsPageProps) {
    return (
        <>
            {/* Page Header */}
            <section className="bg-blue-600 py-12 mt-16">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl font-bold text-white text-center">
                        {getText(t, 'shop.products.title', 'eSIM Travel Packages')}
                    </h1>
                    <p className="text-center text-white/90 mt-2">
                        {getText(t, 'shop.products.subtitle', 'Browse our selection of affordable travel packages')}
                    </p>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-12 bg-gray-50 min-h-[60vh]">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Filter Sidebar */}
                        <div className="lg:w-1/4">
                            <FilterSidebar t={t} />
                        </div>

                        {/* Product Listings */}
                        <div className="lg:w-3/4">
                            {/* Sort and View Controls */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <div className="flex items-center">
                                    <span className="text-gray-600 mr-2">{getText(t, 'shop.products.sortBy', 'Sort by:')}</span>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => onSortChange(e.target.value)}
                                        className="border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="price-asc">{getText(t, 'shop.products.sort.priceAsc', 'Price: Low to High')}</option>
                                        <option value="price-desc">{getText(t, 'shop.products.sort.priceDesc', 'Price: High to Low')}</option>
                                        <option value="name">{getText(t, 'shop.products.sort.name', 'Name')}</option>
                                        <option value="rating">{getText(t, 'shop.products.sort.rating', 'Best Rated')}</option>
                                    </select>
                                </div>
                                <div className="text-gray-600">
                                    {getText(t, 'shop.products.showing', 'Showing')} {products.length} {getText(t, 'shop.products.of', 'of')} {totalProducts} {getText(t, 'shop.products.packages', 'packages')}
                                </div>
                            </div>

                            {/* Product Grid */}
                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[...Array(6)].map((_, i) => (
                                        <ProductSkeleton key={i} />
                                    ))}
                                </div>
                            ) : products.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-gray-600 text-lg">{getText(t, 'shop.products.noProducts', 'No packages found')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {products.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            onAddToCart={onAddToCart}
                                            onProductClick={onProductClick}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center mt-8">
                                    <nav>
                                        <ul className="flex items-center">
                                            <li>
                                                <button
                                                    onClick={() => onPageChange(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                    className="flex items-center justify-center px-3 h-8 text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                    ←
                                                </button>
                                            </li>
                                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                                const page = i + 1;
                                                return (
                                                    <li key={page}>
                                                        <button
                                                            onClick={() => onPageChange(page)}
                                                            className={`flex items-center justify-center px-3 h-8 border border-gray-300 ${page === currentPage ? 'text-blue-600 bg-blue-50' : 'text-gray-500 bg-white hover:bg-gray-100'}`}
                                                        >
                                                            {page}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                            <li>
                                                <button
                                                    onClick={() => onPageChange(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                    className="flex items-center justify-center px-3 h-8 text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                    →
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export default ProductsPage;

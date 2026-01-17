/**
 * TravelPass simple page components - SDK Compliant stubs
 * These provide basic implementations for required ThemePackage components
 */

import type {
    CheckoutPageProps,
    BestsellersPageProps,
    NewArrivalsPageProps,
    CategoriesPageProps,
    SearchPageProps,
    OrdersPageProps,
    OrderDetailPageProps,
    OrderSuccessPageProps,
    OrderCancelledPageProps,
    ProfilePageProps,
    ProfileSettingsPageProps,
    ContactPageProps,
    HelpPageProps,
    PrivacyPageProps,
    TermsPageProps,
    DealsPageProps,
    AffiliateDashboardPageProps,
    LoginPageProps,
    RegisterPageProps,
    AuthCallbackPageProps,
    ProductDetailPageProps,
} from '../../../../shared/src/types/theme';

// BestsellersPage - proper typed stub
export function BestsellersPage({ products, isLoading, onAddToCart, onProductClick, t }: BestsellersPageProps) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-8">Bestsellers</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map((p) => (
                        <div key={p.id} className="bg-white rounded-lg shadow-sm p-4">
                            <img src={p.images?.[0]?.url || 'https://via.placeholder.com/200'} alt={p.name} className="w-full h-40 object-cover rounded mb-4" />
                            <h3 className="font-semibold">{p.name}</h3>
                            <p className="text-blue-600 font-bold">${p.price.toFixed(2)}</p>
                            <button onClick={() => onAddToCart(p.id)} className="w-full mt-2 bg-blue-600 text-white py-2 rounded">Add to Cart</button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// NewArrivalsPage - proper typed stub
export function NewArrivalsPage({ products, isLoading, onAddToCart, onProductClick, t }: NewArrivalsPageProps) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-8">New Arrivals</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map((p) => (
                        <div key={p.id} className="bg-white rounded-lg shadow-sm p-4">
                            <img src={p.images?.[0]?.url || 'https://via.placeholder.com/200'} alt={p.name} className="w-full h-40 object-cover rounded mb-4" />
                            <h3 className="font-semibold">{p.name}</h3>
                            <p className="text-blue-600 font-bold">${p.price.toFixed(2)}</p>
                            <button onClick={() => onAddToCart(p.id)} className="w-full mt-2 bg-blue-600 text-white py-2 rounded">Add to Cart</button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// SearchPage - proper typed stub
export function SearchPage({ products, isLoading, searchQuery, onAddToCart, onProductClick, t }: SearchPageProps) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-4">Search Results</h1>
                {searchQuery && <p className="text-center text-gray-600 mb-8">Results for "{searchQuery}"</p>}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map((p) => (
                        <div key={p.id} className="bg-white rounded-lg shadow-sm p-4">
                            <img src={p.images?.[0]?.url || 'https://via.placeholder.com/200'} alt={p.name} className="w-full h-40 object-cover rounded mb-4" />
                            <h3 className="font-semibold">{p.name}</h3>
                            <p className="text-blue-600 font-bold">${p.price.toFixed(2)}</p>
                            <button onClick={() => onAddToCart(p.id)} className="w-full mt-2 bg-blue-600 text-white py-2 rounded">Add to Cart</button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// DealsPage - proper typed stub
export function DealsPage({ products, isLoading, onAddToCart, onProductClick, t }: DealsPageProps) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-8">Deals & Offers</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map((p) => (
                        <div key={p.id} className="bg-white rounded-lg shadow-sm p-4">
                            <img src={p.images?.[0]?.url || 'https://via.placeholder.com/200'} alt={p.name} className="w-full h-40 object-cover rounded mb-4" />
                            <h3 className="font-semibold">{p.name}</h3>
                            <p className="text-blue-600 font-bold">${p.price.toFixed(2)}</p>
                            <button onClick={() => onAddToCart(p.id)} className="w-full mt-2 bg-blue-600 text-white py-2 rounded">Add to Cart</button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// CheckoutPage
export function CheckoutPage({ cart, isLoading, isProcessing, onSubmit, onBack, t }: CheckoutPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-2xl">
                <h1 className="text-3xl font-bold text-center mb-8">Checkout</h1>
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <form onSubmit={(e) => { e.preventDefault(); onSubmit({} as any); }}>
                        <div className="space-y-4">
                            <input type="email" placeholder="Email" className="w-full border rounded-md p-3" required />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="First Name" className="border rounded-md p-3" required />
                                <input type="text" placeholder="Last Name" className="border rounded-md p-3" required />
                            </div>
                            <input type="text" placeholder="Address" className="w-full border rounded-md p-3" required />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="City" className="border rounded-md p-3" required />
                                <input type="text" placeholder="Postal Code" className="border rounded-md p-3" required />
                            </div>
                        </div>
                        <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md mt-6 transition disabled:opacity-50">
                            {isProcessing ? 'Processing...' : 'Complete Purchase'}
                        </button>
                    </form>
                    <button onClick={onBack} className="w-full text-blue-600 py-3 mt-2">Back to Cart</button>
                </div>
            </div>
        </section>
    );
}

// CategoriesPage
export function CategoriesPage({ categories, isLoading, onCategoryClick, t }: CategoriesPageProps) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-8">Categories</h1>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {categories.map((cat) => (
                        <button key={cat.id} onClick={() => onCategoryClick(cat.id)} className="bg-white p-6 rounded-lg shadow-sm text-center hover:shadow-md transition">
                            <img src={cat.image || 'https://via.placeholder.com/100'} alt={cat.name} className="w-16 h-16 mx-auto mb-4 rounded-full object-cover" />
                            <h3 className="font-semibold">{cat.name}</h3>
                            <p className="text-sm text-gray-500">{cat.productCount} items</p>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}

// OrdersPage
export function OrdersPage({ orders, isLoading, onOrderClick, t }: OrdersPageProps) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-3xl">
                <h1 className="text-3xl font-bold text-center mb-8">My Orders</h1>
                {orders.length === 0 ? (
                    <p className="text-center text-gray-500">No orders yet</p>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <button key={order.id} onClick={() => onOrderClick(order.id)} className="w-full bg-white p-4 rounded-lg shadow-sm text-left hover:shadow-md transition">
                                <div className="flex justify-between">
                                    <span className="font-medium">Order #{order.orderNumber}</span>
                                    <span className="text-gray-500">{order.status}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

// OrderDetailPage
export function OrderDetailPage({ order, isLoading, onBack, t }: OrderDetailPageProps) {
    if (isLoading || !order) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-2xl">
                <button onClick={onBack} className="text-blue-600 mb-4">← Back to Orders</button>
                <h1 className="text-3xl font-bold mb-8">Order #{order.orderNumber}</h1>
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <p><strong>Status:</strong> {order.status}</p>
                    <p><strong>Total:</strong> ${order.total.toFixed(2)}</p>
                </div>
            </div>
        </section>
    );
}

// OrderSuccessPage
export function OrderSuccessPage({ orderNumber, onContinueShopping, onViewOrders, t }: OrderSuccessPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16 flex items-center justify-center">
            <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
                <p className="text-gray-600 mb-8">Order #{orderNumber}</p>
                <div className="space-x-4">
                    <button onClick={onViewOrders} className="bg-blue-600 text-white py-2 px-6 rounded-md">View Orders</button>
                    <button onClick={onContinueShopping} className="border border-blue-600 text-blue-600 py-2 px-6 rounded-md">Continue Shopping</button>
                </div>
            </div>
        </section>
    );
}

// OrderCancelledPage
export function OrderCancelledPage({ onReturnToCart, onContinueShopping, t }: OrderCancelledPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16 flex items-center justify-center">
            <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h1 className="text-3xl font-bold mb-4">Order Cancelled</h1>
                <div className="space-x-4">
                    <button onClick={onReturnToCart} className="bg-blue-600 text-white py-2 px-6 rounded-md">Return to Cart</button>
                    <button onClick={onContinueShopping} className="border border-blue-600 text-blue-600 py-2 px-6 rounded-md">Continue Shopping</button>
                </div>
            </div>
        </section>
    );
}

// ProfilePage
export function ProfilePage({ user, isAuthenticated, onNavigateToSettings, onNavigateToOrders, onNavigateToLogin, t }: ProfilePageProps) {
    if (!isAuthenticated) {
        return (
            <section className="py-12 bg-gray-50 min-h-[60vh] mt-16 flex items-center justify-center">
                <div className="text-center">
                    <p className="mb-4">Please sign in to view your profile</p>
                    <button onClick={onNavigateToLogin} className="bg-blue-600 text-white py-2 px-6 rounded-md">Sign In</button>
                </div>
            </section>
        );
    }
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-2xl">
                <h1 className="text-3xl font-bold mb-8">My Profile</h1>
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <p><strong>Name:</strong> {user?.name}</p>
                    <p><strong>Email:</strong> {user?.email}</p>
                    <div className="mt-6 space-x-4">
                        <button onClick={onNavigateToSettings} className="bg-blue-600 text-white py-2 px-4 rounded-md">Settings</button>
                        <button onClick={onNavigateToOrders} className="border border-blue-600 text-blue-600 py-2 px-4 rounded-md">My Orders</button>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ProfileSettingsPage
export function ProfileSettingsPage({ user, onSaveProfile, onNavigateBack, t }: ProfileSettingsPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-2xl">
                <button onClick={onNavigateBack} className="text-blue-600 mb-4">← Back</button>
                <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <form onSubmit={(e) => { e.preventDefault(); onSaveProfile({}); }}>
                        <input type="text" defaultValue={user?.name} placeholder="Name" className="w-full border rounded-md p-3 mb-4" />
                        <input type="tel" defaultValue={user?.phone} placeholder="Phone" className="w-full border rounded-md p-3 mb-4" />
                        <button type="submit" className="bg-blue-600 text-white py-2 px-6 rounded-md">Save Changes</button>
                    </form>
                </div>
            </div>
        </section>
    );
}

// HelpPage
export function HelpPage({ onNavigateToContact, t }: HelpPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-3xl">
                <h1 className="text-3xl font-bold text-center mb-8">Help Center</h1>
                <div className="grid gap-4">
                    {['Getting Started', 'Account & Billing', 'eSIM Activation', 'Troubleshooting'].map((topic) => (
                        <div key={topic} className="bg-white p-4 rounded-lg shadow-sm">{topic}</div>
                    ))}
                </div>
                <div className="text-center mt-8">
                    <button onClick={onNavigateToContact} className="bg-blue-600 text-white py-2 px-6 rounded-md">Contact Support</button>
                </div>
            </div>
        </section>
    );
}

// ContactPage
export function ContactPage({ onSubmitForm, t }: ContactPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-2xl">
                <h1 className="text-3xl font-bold text-center mb-8">Contact Us</h1>
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <form onSubmit={(e) => { e.preventDefault(); onSubmitForm({ name: '', email: '', subject: '', message: '' }); }}>
                        <input type="text" placeholder="Your Name" className="w-full border rounded-md p-3 mb-4" required />
                        <input type="email" placeholder="Email" className="w-full border rounded-md p-3 mb-4" required />
                        <input type="text" placeholder="Subject" className="w-full border rounded-md p-3 mb-4" required />
                        <textarea placeholder="Message" rows={5} className="w-full border rounded-md p-3 mb-4" required></textarea>
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-md">Send Message</button>
                    </form>
                </div>
            </div>
        </section>
    );
}

// PrivacyPage
export function PrivacyPage({ t }: PrivacyPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-3xl">
                <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
                <div className="bg-white rounded-lg shadow-sm p-6 prose">
                    <p>Your privacy is important to us. This policy explains how we collect, use, and protect your information.</p>
                </div>
            </div>
        </section>
    );
}

// TermsPage
export function TermsPage({ t }: TermsPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-3xl">
                <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
                <div className="bg-white rounded-lg shadow-sm p-6 prose">
                    <p>By using TravelPass, you agree to these terms and conditions.</p>
                </div>
            </div>
        </section>
    );
}

// AffiliateDashboardPage
export function AffiliateDashboardPage({ referralCode, stats, t }: AffiliateDashboardPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4 max-w-3xl">
                <h1 className="text-3xl font-bold mb-8">Affiliate Dashboard</h1>
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <p><strong>Your Referral Code:</strong> {referralCode}</p>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-blue-50 p-4 rounded text-center">
                            <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                            <p className="text-sm text-gray-600">Total Referrals</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded text-center">
                            <p className="text-2xl font-bold">${stats.totalCommissions.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">Total Commissions</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// LoginPage
export function LoginPage({ isLoading, error, onSubmit, onOAuthClick, onNavigateToRegister, t }: LoginPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-sm p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); onSubmit(fd.get('email') as string, fd.get('password') as string); }}>
                    <input name="email" type="email" placeholder="Email" className="w-full border rounded-md p-3 mb-4" required />
                    <input name="password" type="password" placeholder="Password" className="w-full border rounded-md p-3 mb-4" required />
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-md disabled:opacity-50">
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
                <button onClick={() => onOAuthClick('google')} className="w-full border py-3 rounded-md mt-4">Continue with Google</button>
                <p className="text-center mt-4 text-sm text-gray-600">
                    Don't have an account? <button onClick={onNavigateToRegister} className="text-blue-600">Sign Up</button>
                </p>
            </div>
        </section>
    );
}

// RegisterPage
export function RegisterPage({ isLoading, error, onSubmit, onOAuthClick, onNavigateToLogin, t }: RegisterPageProps) {
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-sm p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <form onSubmit={(e) => { e.preventDefault(); onSubmit({} as any); }}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input type="text" placeholder="First Name" className="border rounded-md p-3" required />
                        <input type="text" placeholder="Last Name" className="border rounded-md p-3" required />
                    </div>
                    <input type="email" placeholder="Email" className="w-full border rounded-md p-3 mb-4" required />
                    <input type="password" placeholder="Password" className="w-full border rounded-md p-3 mb-4" required />
                    <input type="password" placeholder="Confirm Password" className="w-full border rounded-md p-3 mb-4" required />
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-md disabled:opacity-50">
                        {isLoading ? 'Creating...' : 'Create Account'}
                    </button>
                </form>
                <p className="text-center mt-4 text-sm text-gray-600">
                    Already have an account? <button onClick={onNavigateToLogin} className="text-blue-600">Sign In</button>
                </p>
            </div>
        </section>
    );
}

// AuthCallbackPage
export function AuthCallbackPage({ provider, isLoading, error, onRetry, onNavigateToHome, t }: AuthCallbackPageProps) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Authenticating with {provider}...</div>;
    if (error) return (
        <div className="min-h-screen flex items-center justify-center text-center">
            <div>
                <p className="text-red-500 mb-4">{error}</p>
                <button onClick={onRetry} className="bg-blue-600 text-white py-2 px-6 rounded-md mr-2">Retry</button>
                <button onClick={onNavigateToHome} className="border py-2 px-6 rounded-md">Go Home</button>
            </div>
        </div>
    );
    return <div className="min-h-screen flex items-center justify-center">Redirecting...</div>;
}

// ProductDetailPage
export function ProductDetailPage({ product, isLoading, quantity, onQuantityChange, onAddToCart, onBack, t }: ProductDetailPageProps) {
    if (isLoading || !product) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return (
        <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
            <div className="container mx-auto px-4">
                <button onClick={onBack} className="text-blue-600 mb-4">← Back</button>
                <div className="bg-white rounded-lg shadow-sm p-6 grid md:grid-cols-2 gap-8">
                    <img src={product.images?.[0]?.url || 'https://via.placeholder.com/400'} alt={product.name} className="w-full h-80 object-cover rounded-lg" />
                    <div>
                        <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
                        <p className="text-gray-600 mb-4">{product.description}</p>
                        <p className="text-2xl font-bold text-blue-600 mb-6">${product.price.toFixed(2)}</p>
                        <div className="flex items-center gap-4 mb-6">
                            <button onClick={() => onQuantityChange(Math.max(1, quantity - 1))} className="w-10 h-10 border rounded">-</button>
                            <span className="text-lg">{quantity}</span>
                            <button onClick={() => onQuantityChange(quantity + 1)} className="w-10 h-10 border rounded">+</button>
                        </div>
                        <button onClick={onAddToCart} className="w-full bg-blue-600 text-white py-3 rounded-md">Add to Cart</button>
                    </div>
                </div>
            </div>
        </section>
    );
}

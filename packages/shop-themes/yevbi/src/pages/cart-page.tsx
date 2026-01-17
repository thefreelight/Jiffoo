/**
 * TravelPass Cart Page Component
 * 
 * SDK-compliant component accepting CartPageProps from theme.ts
 */

import type { CartPageProps } from '../../../../shared/src/types/theme';

// Helper for translations with fallback
const getText = (t: CartPageProps['t'], key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
};

export function CartPage({
    cart,
    isLoading,
    config,
    onUpdateQuantity,
    onRemoveItem,
    onCheckout,
    onContinueShopping,
    t,
}: CartPageProps) {
    const subtotal = cart?.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    if (isLoading) {
        return (
            <section className="py-12 bg-gray-50 min-h-[60vh] mt-16">
                <div className="container mx-auto px-4 text-center">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <>
            {/* Page Header */}
            <section className="bg-blue-600 py-12 mt-16">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl font-bold text-white text-center">
                        {getText(t, 'shop.cart.title', 'Shopping Cart')}
                    </h1>
                    <p className="text-center text-white/90 mt-2">
                        {getText(t, 'shop.cart.subtitle', 'Review your eSIM packages before checkout')}
                    </p>
                </div>
            </section>

            <section className="py-12 bg-gray-50 min-h-[60vh]">
                <div className="container mx-auto px-4">
                    {!cart?.items || cart.items.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-gray-600 text-lg mb-6">{getText(t, 'shop.cart.empty', 'Your cart is empty')}</p>
                            <button
                                onClick={onContinueShopping}
                                className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md transition"
                            >
                                {getText(t, 'shop.cart.continueShopping', 'Continue Shopping')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Cart Items */}
                            <div className="lg:w-2/3">
                                <div className="bg-white rounded-lg shadow-sm p-6">
                                    <h2 className="text-xl font-semibold mb-6">
                                        {getText(t, 'shop.cart.yourItems', 'Your Items')} ({cart.items.length})
                                    </h2>

                                    {cart.items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-4 py-4 border-b border-gray-200 last:border-0">
                                            <img
                                                src={item.productImage || 'https://via.placeholder.com/100'}
                                                alt={item.productName}
                                                className="w-24 h-24 object-cover rounded-lg"
                                            />
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-800">{item.productName}</h3>
                                                <p className="text-sm text-gray-500">{item.variantName || 'Standard'}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <button
                                                        onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                                        className="w-8 h-8 border rounded hover:bg-gray-100"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-8 text-center">{item.quantity}</span>
                                                    <button
                                                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                                        className="w-8 h-8 border rounded hover:bg-gray-100"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
                                                <button
                                                    onClick={() => onRemoveItem(item.id)}
                                                    className="text-red-500 text-sm hover:text-red-700"
                                                >
                                                    {getText(t, 'shop.cart.remove', 'Remove')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div className="lg:w-1/3">
                                <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                                    <h2 className="text-xl font-semibold mb-6">{getText(t, 'shop.cart.summary', 'Order Summary')}</h2>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">{getText(t, 'shop.cart.subtotal', 'Subtotal')}</span>
                                            <span className="font-medium">${subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">{getText(t, 'shop.cart.tax', 'Tax')}</span>
                                            <span className="font-medium">${tax.toFixed(2)}</span>
                                        </div>
                                        <div className="border-t pt-3 flex justify-between">
                                            <span className="text-lg font-semibold">{getText(t, 'shop.cart.total', 'Total')}</span>
                                            <span className="text-lg font-bold text-blue-600">${total.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={onCheckout}
                                        className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-md font-medium transition"
                                    >
                                        {getText(t, 'shop.cart.checkout', 'Proceed to Checkout')}
                                    </button>

                                    <button
                                        onClick={onContinueShopping}
                                        className="block w-full text-center text-blue-600 hover:text-blue-700 py-3 mt-2"
                                    >
                                        {getText(t, 'shop.cart.continueShopping', 'Continue Shopping')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}

export default CartPage;

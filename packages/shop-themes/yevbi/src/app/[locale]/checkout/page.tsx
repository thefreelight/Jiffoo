'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CreditCard,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Mail,
  Phone,
  User,
  Lock,
  Loader2,
  AlertCircle,
  Smartphone,
  Info,
  Cpu,
  Zap,
  Globe,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Fingerprint,
  Package,
} from 'lucide-react';
import { AuthGuard } from '../../../components/AuthGuard';
import { cartApi, ordersApi, paymentApi, authApi, type AvailablePaymentMethod, type Cart } from '../../../lib/api';
import { formatVariantNameWithBillingPeriod } from '../../../lib/esim';
import { Button } from '../../../ui/Button';
import { cn } from '../../../lib/utils';

function CheckoutContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<AvailablePaymentMethod[]>([]);
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    async function fetchCart() {
      setIsLoading(true);
      setError(null);
      try {
        const [cartData, methods, userProfile] = await Promise.all([
          cartApi.getCart(),
          paymentApi.getAvailableMethods(),
          authApi.getProfile(),
        ]);
        setCart(cartData);
        setAvailablePaymentMethods(methods);
        // Auto-fill email from logged-in user
        if (userProfile?.email) {
          setEmail(userProfile.email);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'FAILED TO LOAD ASSETS');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCart();
  }, [locale]);

  useEffect(() => {
    if (availablePaymentMethods.length === 0) {
      setPaymentMethod('');
      return;
    }
    if (!availablePaymentMethods.some((method) => method.name === paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0].name);
    }
  }, [availablePaymentMethods, paymentMethod]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!paymentMethod) {
      setError('NO PAYMENT GATEWAY AVAILABLE: INSTALL AND ENABLE A PAYMENT PLUGIN');
      return;
    }

    if (!agreeTerms) {
      setError('PROTOCOL AUTHORIZATION REQUIRED: AGREE TO TERMS');
      return;
    }

    if (!cart || cart.items.length === 0) {
      setError('ZERO ASSETS DETECTED IN DOCK');
      return;
    }

    const requiresShippingAddress = cart.items.some((item) => item.requiresShipping !== false);
    if (requiresShippingAddress) {
      setError('THIS CHECKOUT CURRENTLY SUPPORTS DIGITAL ORDERS ONLY. PLEASE USE A SHIPPING-ENABLED THEME FOR PHYSICAL ITEMS.');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderResponse = await ordersApi.createOrder({
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
        })),
      });

      if (!orderResponse?.id) throw new Error('ORDER GENESIS FAILED');
      const orderId = orderResponse.id;

      const paymentResponse = await paymentApi.createSession({
        paymentMethod,
        orderId,
        successUrl: `${window.location.origin}/${locale}/order-success?orderId=${orderId}`,
        cancelUrl: `${window.location.origin}/${locale}/checkout`
      });

      if (paymentResponse?.url) {
        window.location.href = paymentResponse.url;
      } else {
        router.push(`/${locale}/order-success?orderId=${orderId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TRANSACTION ABORTED: SECURE CHANNEL ERROR');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-foreground animate-spin" />
            <Fingerprint className="w-6 h-6 text-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-muted-foreground font-black uppercase tracking-[0.3em] italic text-xs animate-pulse transition-colors duration-300">Syncing Secure Channel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 transition-colors duration-300">
      <div className="network-grid-bg"></div>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back button */}
        <button
          onClick={() => router.push(`/${locale}/cart`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Customer Information Form */}
          <div>
            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-6">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm text-muted-foreground mb-2 font-mono uppercase tracking-widest text-[10px]">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  readOnly
                  className="w-full px-4 py-3 bg-muted border border-border text-muted-foreground cursor-not-allowed font-mono text-sm"
                  placeholder="your@email.com"
                  required
                />
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm text-muted-foreground mb-2 font-mono uppercase tracking-widest text-[10px]">Full Name</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 bg-muted border border-border text-foreground font-mono text-sm focus:outline-none focus:border-foreground transition-colors"
                    placeholder="First"
                    required
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 bg-muted border border-border text-foreground font-mono text-sm focus:outline-none focus:border-foreground transition-colors"
                    placeholder="Last"
                    required
                  />
                </div>
              </div>

              {/* Phone (optional) */}
              <div>
                <label htmlFor="phone" className="block text-sm text-muted-foreground mb-2 font-mono uppercase tracking-widest text-[10px]">
                  Phone <span className="text-muted-foreground/40 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-muted border border-border text-foreground font-mono text-sm focus:outline-none focus:border-foreground transition-colors"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-border my-6" />

              {/* Payment Method */}
              {availablePaymentMethods.length > 0 && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-3 font-mono uppercase tracking-widest text-[10px]">Payment Method</label>
                  <div className="space-y-2">
                    {availablePaymentMethods.map((method) => (
                      <label
                        key={method.name}
                        className={cn(
                          "flex items-center gap-3 p-4 border cursor-pointer transition-colors",
                          paymentMethod === method.name
                            ? "border-foreground bg-muted"
                            : "border-border hover:border-foreground hover:bg-muted"
                        )}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.name}
                          checked={paymentMethod === method.name}
                          onChange={() => setPaymentMethod(method.name)}
                          className="w-4 h-4 accent-foreground"
                        />
                        {getPaymentMethodIcon(method.name)}
                        <span className="text-sm text-foreground font-mono">{method.displayName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Terms Agreement */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 cursor-pointer accent-foreground"
                  required
                />
                <label htmlFor="terms" className="text-[10px] text-muted-foreground leading-relaxed cursor-pointer font-mono uppercase tracking-widest">
                  I agree to the <button type="button" className="text-foreground hover:underline">Terms of Service</button> and <button type="button" className="text-foreground hover:underline">Privacy Policy</button>
                </label>
              </div>
            </form>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-muted border border-border p-6">
              <h2 className="text-lg font-bold text-foreground mb-6 uppercase tracking-tight">Order Summary</h2>

              {/* Product List */}
              <div className="space-y-4 mb-6">
                {cart?.items.map((item) => {
                  const variantDisplayName = formatVariantNameWithBillingPeriod(
                    item.variantName,
                    item.variantAttributes
                  );
                  return (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-16 h-16 bg-background border border-border overflow-hidden flex-shrink-0">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground uppercase tracking-tight truncate">{item.productName}</p>
                        {variantDisplayName && (
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{variantDisplayName}</p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Qty: {item.quantity}</span>
                          <span className="text-sm font-bold text-foreground font-mono">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-border pt-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Subtotal</span>
                  <span className="font-mono text-sm font-bold text-foreground">${cart?.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tax</span>
                  <span className="font-mono text-sm font-bold text-foreground">${cart?.tax.toFixed(2)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-border pt-4 mb-6">
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-bold text-foreground uppercase tracking-tight">Total</span>
                  <span className="text-2xl font-bold text-foreground font-mono">${cart?.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 flex gap-3 items-start">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive font-mono uppercase tracking-widest">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                form="checkout-form"
                disabled={isSubmitting || !cart?.items.length || availablePaymentMethods.length === 0}
                size="lg"
                className="w-full h-14 text-base font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    Authorize Payment
                  </span>
                )}
              </Button>

              {/* Security Notice */}
              <div className="mt-4 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground/40 leading-relaxed font-mono uppercase tracking-widest">
                  Secure checkout. Your payment information is encrypted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPaymentMethodIcon(methodName: string): React.ReactNode {
  const normalized = methodName.trim().toLowerCase();
  if (normalized.includes('apple') || normalized.includes('google') || normalized.includes('wallet')) {
    return <Smartphone className="w-6 h-6" />;
  }
  return <CreditCard className="w-6 h-6" />;
}

function PaymentTab({ active, onClick, icon, label, description }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, description: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-8 rounded-none border-2 transition-all gap-4 group/tab ",
        active
          ? "border-foreground bg-muted text-foreground scale-105 z-10"
          : "border-border bg-background text-muted-foreground hover:border-foreground hover:bg-muted active:scale-95"
      )}
    >
      <div className={cn(
        "p-4 rounded-none transition-all",
        active ? "bg-muted text-foreground rotate-6" : "bg-muted text-foreground group-hover/tab:rotate-3"
      )}>
        {icon}
      </div>
      <div className="text-center">
        <span className="block text-xs font-black uppercase tracking-[0.1em] italic leading-none mb-1">{label}</span>
        <span className="block text-[8px] font-bold text-muted-foreground uppercase tracking-widest italic">{description}</span>
      </div>
    </button>
  );
}

function ChevronRightSmall({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <CheckoutContent />
    </AuthGuard>
  );
}

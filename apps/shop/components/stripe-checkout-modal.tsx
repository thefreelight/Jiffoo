'use client';

import * as React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(publishableKey: string): Promise<Stripe | null> {
    const normalizedKey = publishableKey.trim();
    if (!normalizedKey) {
        return Promise.resolve(null);
    }

    const existing = stripePromiseCache.get(normalizedKey);
    if (existing) {
        return existing;
    }

    const promise = loadStripe(normalizedKey);
    stripePromiseCache.set(normalizedKey, promise);
    return promise;
}

interface CheckoutFormProps {
    onSuccess: () => void;
    onError: (error: string) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ onSuccess, onError }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            // Stripe.js hasn't yet loaded.
            return;
        }

        setIsLoading(true);

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL is required for some payment methods, but we try to keep it on-page.
                return_url: `${window.location.origin}/en/order-success`,
            },
            redirect: "if_required", // Prevent redirect if possible to keep SPA experience
        });

        if (error) {
            if (error.type === 'card_error' || error.type === 'validation_error') {
                onError(error.message as string);
            } else {
                onError('An unexpected error occurred.');
            }
        } else {
            onSuccess();
        }

        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            <button
                type="submit"
                disabled={isLoading || !stripe || !elements}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-md font-medium text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? 'Processing...' : 'Pay Now'}
            </button>
        </form>
    );
};

interface StripeCheckoutModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    publishableKey: string;
    clientSecret: string;
    orderId: string;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
    isOpen,
    onOpenChange,
    publishableKey,
    clientSecret,
    orderId,
}) => {
    const nav = useLocalizedNavigation();
    const stripePromise = React.useMemo(
        () => getStripePromise(publishableKey),
        [publishableKey]
    );

    const handleSuccess = React.useCallback(() => {
        // Payment was successful, handle post-payment logic and redirect
        nav.push(`/order-success?session_id=stripe_${orderId}`);
    }, [nav, orderId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-[500px] w-full max-h-[90vh] overflow-y-auto shadow-xl ring-1 ring-black/5 relative p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Complete your payment securely</h2>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors p-1"
                        aria-label="Close"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {clientSecret && publishableKey && (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <CheckoutForm
                            onSuccess={handleSuccess}
                            onError={(err) => {
                                console.error("Stripe Checkout Error:", err);
                                // The PaymentElement generally displays card errors natively, 
                                // but this hooks catches unexpected flows.
                            }}
                        />
                    </Elements>
                )}
            </div>
        </div>
    );
};

/**
 * Checkout Page Component - Admin Style Design
 */

import React from 'react';
import { ArrowLeft, CreditCard, Truck, Lock, Wallet } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { CheckoutPageProps } from 'shared/src/types/theme';

export const CheckoutPage = React.memo(function CheckoutPage({
  cart,
  isLoading,
  isProcessing,
  config,
  requireShippingAddress,
  countriesRequireStatePostal,
  currentUserEmail,
  availablePaymentMethods,
  onSubmit,
  onBack,
  t,
}: CheckoutPageProps) {
  const countriesRequireStatePostalSet = React.useMemo(() => {
    const source = countriesRequireStatePostal && countriesRequireStatePostal.length > 0
      ? countriesRequireStatePostal
      : ['US', 'CA', 'AU', 'CN', 'GB'];
    return new Set(
      source
        .map((item) => item.trim().toUpperCase())
        .map((item) => (item === 'UK' ? 'GB' : item))
    );
  }, [countriesRequireStatePostal]);

  const paymentMethods = React.useMemo(
    () => availablePaymentMethods || [],
    [availablePaymentMethods]
  );

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const [formData, setFormData] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    paymentMethod: paymentMethods[0]?.name || '',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const hasShippingInput = React.useMemo(
    () => [
      formData.firstName,
      formData.lastName,
      formData.phone,
      formData.addressLine1,
      formData.city,
      formData.state,
      formData.postalCode,
      formData.country,
    ].some((value) => value.trim().length > 0),
    [formData]
  );

  const shouldEnforceShippingAddress = Boolean(requireShippingAddress || hasShippingInput);
  const countryCode = formData.country.trim().toUpperCase();
  const normalizedCountryCode = countryCode === 'UK' ? 'GB' : countryCode;
  const statePostalRequired = shouldEnforceShippingAddress && countriesRequireStatePostalSet.has(normalizedCountryCode);

  React.useEffect(() => {
    if (paymentMethods.length === 0) return;

    if (!paymentMethods.some((method) => method.name === formData.paymentMethod)) {
      setFormData((prev) => ({
        ...prev,
        paymentMethod: paymentMethods[0].name,
      }));
    }
  }, [formData.paymentMethod, paymentMethods]);

  React.useEffect(() => {
    if (!currentUserEmail) return;
    setFormData((prev) => {
      if (prev.email === currentUserEmail) return prev;
      if (prev.email.trim().length > 0) return prev;
      return {
        ...prev,
        email: currentUserEmail,
      };
    });
  }, [currentUserEmail]);

  const getPaymentIcon = (methodName: string) => {
    const normalized = methodName.toLowerCase();
    if (normalized === 'stripe' || normalized === 'card') {
      return CreditCard;
    }
    return Wallet;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (shouldEnforceShippingAddress) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
      if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
      if (!formData.country.trim()) newErrors.country = 'Country is required';
      if (statePostalRequired) {
        if (!formData.state.trim()) newErrors.state = 'State is required for the selected country';
        if (!formData.postalCode.trim()) newErrors.postalCode = 'Postal code is required for the selected country';
      }
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(formData);
  };

  const inputStyles = cn(
    'w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-slate-700',
    'bg-gray-50/50 dark:bg-slate-800 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400',
    'transition-all duration-150'
  );

  const errorInputStyles = 'border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-700 transition-all shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">SECURE CHECKOUT</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Checkout</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Left: Checkout form */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Shipping Information */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">STEP 1</span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Shipping Information</h2>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="email" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">EMAIL</label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={cn(inputStyles, errors.email && errorInputStyles)}
                          placeholder="your@email.com"
                        />
                        {errors.email && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.email}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="firstName" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                            FIRST NAME{shouldEnforceShippingAddress ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.firstName && errorInputStyles)}
                          />
                          {errors.firstName && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.firstName}</p>}
                        </div>
                        <div>
                          <label htmlFor="lastName" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                            LAST NAME{shouldEnforceShippingAddress ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.lastName && errorInputStyles)}
                          />
                          {errors.lastName && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.lastName}</p>}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="addressLine1" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                          ADDRESS{shouldEnforceShippingAddress ? ' *' : ''}
                        </label>
                        <input
                          type="text"
                          id="addressLine1"
                          name="addressLine1"
                          value={formData.addressLine1}
                          onChange={handleChange}
                          className={cn(inputStyles, errors.addressLine1 && errorInputStyles)}
                          placeholder="Street address"
                        />
                        {errors.addressLine1 && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.addressLine1}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="city" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                            CITY{shouldEnforceShippingAddress ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.city && errorInputStyles)}
                          />
                          {errors.city && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.city}</p>}
                        </div>
                        <div>
                          <label htmlFor="state" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                            STATE{statePostalRequired ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            id="state"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.state && errorInputStyles)}
                            placeholder="e.g., CA, NY"
                          />
                          {errors.state && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.state}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="postalCode" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                            POSTAL CODE{statePostalRequired ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            id="postalCode"
                            name="postalCode"
                            value={formData.postalCode}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.postalCode && errorInputStyles)}
                          />
                          {errors.postalCode && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.postalCode}</p>}
                        </div>
                        <div>
                          <label htmlFor="country" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                            COUNTRY{shouldEnforceShippingAddress ? ' *' : ''}
                          </label>
                          <input
                            type="text"
                            id="country"
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.country && errorInputStyles)}
                            placeholder="Country / Region"
                          />
                          {errors.country && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.country}</p>}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="phone" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">
                          PHONE NUMBER{shouldEnforceShippingAddress ? ' *' : ''}
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className={cn(inputStyles, errors.phone && errorInputStyles)}
                        />
                        {errors.phone && <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium">{errors.phone}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">STEP 2</span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Payment Method</h2>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {paymentMethods.length === 0 ? (
                        <div className="p-8 text-center bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-2xl">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                            <CreditCard className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            {getText('shop.checkout.noPaymentMethods', 'No Payment Methods Available')}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {getText('shop.checkout.installPaymentPlugin', 'Please install a payment plugin to enable checkout functionality.')}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {getText('shop.checkout.contactAdmin', 'Contact your administrator to configure payment methods.')}
                          </p>
                        </div>
                      ) : (
                        paymentMethods.map((method) => {
                          const Icon = getPaymentIcon(method.name);
                          return (
                            <label
                              key={method.name}
                              className={cn(
                                'flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all',
                                formData.paymentMethod === method.name
                                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                                  : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                              )}
                            >
                              <input
                                type="radio"
                                name="paymentMethod"
                                value={method.name}
                                checked={formData.paymentMethod === method.name}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600"
                              />
                              <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              <span className="font-bold text-sm text-gray-900 dark:text-white">{method.displayName.toUpperCase()}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || isProcessing || paymentMethods.length === 0}
                  className="w-full h-12 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  {isProcessing ? getText('shop.checkout.processing', 'PROCESSING...') : getText('shop.checkout.placeOrder', 'PLACE ORDER')}
                </button>

                <p className="text-xs text-gray-500 text-center font-medium">
                  {getText('shop.checkout.termsNotice', 'By clicking "Place Order", you agree to our Terms of Service and Privacy Policy')}
                </p>
              </form>
            </div>

            {/* Right: Order summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm sticky top-8">
                <div className="p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">ORDER SUMMARY</h2>
                  </div>

                  {/* Product list */}
                  <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                          <img
                            src={item.productImage || '/placeholder-product.svg'}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate text-gray-900">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-xs text-gray-500 uppercase tracking-wider">{item.variantName}</p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-500 font-medium">x{item.quantity}</p>
                            <p className="text-sm font-bold text-blue-600">${item.subtotal.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price breakdown */}
                  <div className="space-y-3 mb-6 border-t border-gray-100 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Subtotal</span>
                      <span className="text-gray-900 font-bold">${cart.subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Shipping</span>
                      <span className={cart.shipping === 0 ? 'text-green-600 font-bold' : 'text-gray-900 font-bold'}>
                        {cart.shipping === 0 ? 'FREE' : `$${cart.shipping.toFixed(2)}`}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Tax</span>
                      <span className="text-gray-900 font-bold">${cart.tax.toFixed(2)}</span>
                    </div>

                    {((cart.discount || 0) > 0 || (cart as any)?.discountAmount > 0) && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="flex items-center gap-2 font-medium">
                          Discount
                          {(cart as any)?.appliedDiscountCodes && (cart as any).appliedDiscountCodes.length > 0 && (
                            <span className="text-xs text-gray-500">
                              ({(cart as any).appliedDiscountCodes.join(', ')})
                            </span>
                          )}
                        </span>
                        <span className="font-bold">-${((cart as any)?.discountAmount || cart.discount || 0).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex justify-between text-lg">
                        <span className="text-gray-900 font-bold">Total</span>
                        <span className="text-blue-600 font-bold">${cart.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Security notice */}
                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
                    <Lock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-green-700 font-medium leading-relaxed">
                      Your payment information is encrypted and secure. We do not store your credit card details.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

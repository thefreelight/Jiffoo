/**
 * Payment Plugin Test Page
 *
 * Test payment functionality to verify plugin hot-swap capabilities.
 */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { CreditCard, DollarSign, ShoppingCart, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useT } from 'shared/src/i18n/react';

interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  description?: string;
  customerId?: string;
}

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  clientSecret?: string;
  error?: string;
  message?: string;
}

export default function PaymentTestPage() {
  const { addToast } = useToast();
  const t = useT();

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentRequest>({
    amount: 10.00,
    currency: 'USD',
    orderId: `order_${Date.now()}`,
    description: 'Test Payment for Plugin Hot-Swap Testing',
    customerId: 'test_customer_123'
  });
  const [lastPaymentResult, setLastPaymentResult] = useState<PaymentResult | null>(null);

  const getAuthToken = () => {
    return localStorage.getItem('token') || localStorage.getItem('authToken');
  };

  const handleInputChange = (field: keyof PaymentRequest, value: string | number) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const testStripePayment = async () => {
    setIsLoading(true);
    setLastPaymentResult(null);

    try {
      const token = getAuthToken();
      if (!token) {
        addToast({
          type: 'error',
          title: 'Authentication Required',
          description: 'Please login to test payments.',
          duration: 5000
        });
        return;
      }

      addToast({
        type: 'info',
        title: 'Creating Payment',
        description: 'Testing Stripe payment integration...',
        duration: 3000
      });

      // Call Stripe plugin payment API
      const response = await fetch('http://localhost:8001/plugins/stripe/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setLastPaymentResult({
          success: true,
          paymentId: result.data?.paymentIntentId || result.data?.id,
          clientSecret: result.data?.clientSecret,
          message: 'Payment intent created successfully'
        });

        addToast({
          type: 'success',
          title: 'Payment Created',
          description: `Stripe payment intent created successfully! ID: ${result.data?.paymentIntentId || result.data?.id}`,
          duration: 7000
        });
      } else {
        setLastPaymentResult({
          success: false,
          error: result.error || result.message || 'Payment creation failed',
          message: result.message || 'Unknown error occurred'
        });

        addToast({
          type: 'error',
          title: 'Payment Failed',
          description: result.error || result.message || 'Failed to create payment. Plugin may be inactive.',
          duration: 7000
        });
      }
    } catch (error) {
      console.error('Payment test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred';

      setLastPaymentResult({
        success: false,
        error: errorMessage,
        message: 'Failed to connect to payment service'
      });

      addToast({
        type: 'error',
        title: 'Connection Failed',
        description: 'Failed to connect to Stripe plugin. Plugin may be deactivated or uninstalled.',
        duration: 7000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testAlipayPayment = async () => {
    setIsLoading(true);
    setLastPaymentResult(null);

    try {
      const token = getAuthToken();
      if (!token) {
        addToast({
          type: 'error',
          title: 'Authentication Required',
          description: 'Please login to test payments.',
          duration: 5000
        });
        return;
      }

      addToast({
        type: 'info',
        title: 'Creating Payment',
        description: 'Testing Alipay payment integration...',
        duration: 3000
      });

      // Call Alipay plugin payment API
      const response = await fetch('http://localhost:8001/plugins/alipay-official/api/create-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...paymentData,
          amount: paymentData.amount * 100, // Alipay uses cents/fen as unit
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setLastPaymentResult({
          success: true,
          paymentId: result.data?.paymentId || result.data?.id,
          clientSecret: result.data?.paymentUrl || result.data?.qrCode,
          message: 'Alipay payment created successfully'
        });

        addToast({
          type: 'success',
          title: 'Payment Created',
          description: `Alipay payment created successfully! ID: ${result.data?.paymentId || result.data?.id}`,
          duration: 7000
        });
      } else {
        setLastPaymentResult({
          success: false,
          error: result.error || result.message || 'Payment creation failed',
          message: result.message || 'Unknown error occurred'
        });

        addToast({
          type: 'error',
          title: 'Payment Failed',
          description: result.error || result.message || 'Failed to create payment. Plugin may be inactive.',
          duration: 7000
        });
      }
    } catch (error) {
      console.error('Alipay payment test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred';

      setLastPaymentResult({
        success: false,
        error: errorMessage,
        message: 'Failed to connect to payment service'
      });

      addToast({
        type: 'error',
        title: 'Connection Failed',
        description: 'Failed to connect to Alipay plugin. Plugin may be deactivated or uninstalled.',
        duration: 7000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewOrderId = () => {
    setPaymentData(prev => ({
      ...prev,
      orderId: `order_${Date.now()}`
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{getText('merchant.paymentTest.title', 'Payment Plugin Test')}</h1>
        <p className="text-gray-600 mt-2">
          {getText('merchant.paymentTest.subtitle', 'Test payment functionality to verify plugin hot-swap capabilities')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {getText('merchant.paymentTest.stripeTest', 'Stripe Payment Test')}
            </CardTitle>
            <CardDescription>
              {getText('merchant.paymentTest.stripeTestDesc', 'Create a test payment to verify Stripe plugin functionality')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">{getText('merchant.paymentTest.amount', 'Amount')}</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.50"
                  value={paymentData.amount}
                  onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="currency">{getText('merchant.paymentTest.currency', 'Currency')}</Label>
                <Select value={paymentData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="orderId">{getText('merchant.paymentTest.orderId', 'Order ID')}</Label>
              <div className="flex gap-2">
                <Input
                  id="orderId"
                  value={paymentData.orderId}
                  onChange={(e) => handleInputChange('orderId', e.target.value)}
                />
                <Button variant="outline" onClick={generateNewOrderId}>
                  {getText('merchant.paymentTest.new', 'New')}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="description">{getText('merchant.paymentTest.description', 'Description')}</Label>
              <Input
                id="description"
                value={paymentData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="customerId">{getText('merchant.paymentTest.customerId', 'Customer ID')}</Label>
              <Input
                id="customerId"
                value={paymentData.customerId}
                onChange={(e) => handleInputChange('customerId', e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Button
                onClick={testStripePayment}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {getText('merchant.paymentTest.creatingPayment', 'Creating Payment...')}
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    {getText('merchant.paymentTest.testStripe', 'Test Stripe Payment')}
                  </>
                )}
              </Button>

              <Button
                onClick={testAlipayPayment}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {getText('merchant.paymentTest.creatingPayment', 'Creating Payment...')}
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    {getText('merchant.paymentTest.testAlipay', 'Test Alipay Payment')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Result */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {getText('merchant.paymentTest.paymentResult', 'Payment Result')}
            </CardTitle>
            <CardDescription>
              {getText('merchant.paymentTest.paymentResultDesc', 'View the result of your payment test')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastPaymentResult ? (
              <div className="space-y-4">
                <div className={`flex items-center gap-2 p-4 rounded-lg ${lastPaymentResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                  {lastPaymentResult.success ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {lastPaymentResult.success ? getText('merchant.paymentTest.paymentSuccess', 'Payment Created Successfully') : getText('merchant.paymentTest.paymentFailed', 'Payment Failed')}
                  </span>
                </div>

                {lastPaymentResult.success && lastPaymentResult.paymentId && (
                  <div className="space-y-2">
                    <div>
                      <Label>{getText('merchant.paymentTest.paymentId', 'Payment ID')}</Label>
                      <div className="p-2 bg-gray-100 rounded font-mono text-sm">
                        {lastPaymentResult.paymentId}
                      </div>
                    </div>
                    {lastPaymentResult.clientSecret && (
                      <div>
                        <Label>{getText('merchant.paymentTest.clientSecret', 'Client Secret')}</Label>
                        <div className="p-2 bg-gray-100 rounded font-mono text-sm break-all">
                          {lastPaymentResult.clientSecret}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!lastPaymentResult.success && lastPaymentResult.error && (
                  <div>
                    <Label>{getText('merchant.paymentTest.errorDetails', 'Error Details')}</Label>
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                      {lastPaymentResult.error}
                    </div>
                  </div>
                )}

                {lastPaymentResult.message && (
                  <div>
                    <Label>{getText('merchant.paymentTest.message', 'Message')}</Label>
                    <div className="p-2 bg-gray-100 rounded text-sm">
                      {lastPaymentResult.message}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{getText('merchant.paymentTest.noResults', 'No payment test results yet')}</p>
                <p className="text-sm">{getText('merchant.paymentTest.clickToBegin', 'Click "Test Stripe Payment" to begin')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{getText('merchant.paymentTest.instructions', 'Hot-Swap Testing Instructions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-green-600 mb-2">{getText('merchant.paymentTest.step1Title', '1. Test Active Plugin')}</h4>
              <p className="text-sm text-gray-600">
                {getText('merchant.paymentTest.step1Desc', 'Create a payment while Stripe plugin is active. Should succeed.')}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-orange-600 mb-2">{getText('merchant.paymentTest.step2Title', '2. Test Deactivated Plugin')}</h4>
              <p className="text-sm text-gray-600">
                {getText('merchant.paymentTest.step2Desc', 'Deactivate Stripe plugin, then test payment. Should fail gracefully.')}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-red-600 mb-2">{getText('merchant.paymentTest.step3Title', '3. Test Uninstalled Plugin')}</h4>
              <p className="text-sm text-gray-600">
                {getText('merchant.paymentTest.step3Desc', 'Uninstall Stripe plugin, then test payment. Should fail with plugin not found.')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

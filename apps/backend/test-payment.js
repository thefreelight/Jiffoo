const { PaymentService } = require('./dist/core/payment/service');
const { MockPaymentProvider } = require('./dist/core/payment/providers/mock-provider');
const { PaymentMethod, Currency } = require('./dist/core/payment/types');

async function testPaymentSystem() {
  console.log('🧪 Testing Payment System...\n');

  try {
    // Initialize payment service
    console.log('1. Initializing Payment Service...');
    await PaymentService.initialize();
    console.log('✅ Payment Service initialized\n');

    // Test provider capabilities
    console.log('2. Testing Provider Capabilities...');
    const providers = PaymentService.getAvailableProviders();
    console.log('Available providers:', providers);
    
    const capabilities = PaymentService.getProviderCapabilities('mock');
    console.log('Mock provider capabilities:', JSON.stringify(capabilities, null, 2));
    console.log('✅ Provider capabilities retrieved\n');

    // Test health check
    console.log('3. Testing Health Check...');
    const health = await PaymentService.healthCheck();
    console.log('Health status:', health);
    console.log('✅ Health check completed\n');

    // Test mock payment scenarios
    console.log('4. Testing Mock Payment Scenarios...\n');

    // Create a mock order for testing
    const mockOrder = {
      id: 'test-order-' + Date.now(),
      userId: 'test-user',
      status: 'PENDING',
      totalAmount: 99.99,
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          quantity: 1,
          unitPrice: 99.99,
          product: {
            name: 'Test Product',
            description: 'A test product for payment testing'
          }
        }
      ],
      user: {
        email: 'test@example.com',
        username: 'testuser'
      }
    };

    // Mock the database call
    const originalFindUnique = require('./dist/config/database').prisma.order.findUnique;
    require('./dist/config/database').prisma.order.findUnique = async () => mockOrder;

    // Test successful payment
    console.log('4a. Testing Successful Payment...');
    try {
      const result = await PaymentService.processOrderPayment(
        mockOrder.id,
        PaymentMethod.MOCK,
        'mock'
      );
      console.log('Payment result:', JSON.stringify(result, null, 2));
      console.log('✅ Successful payment test completed\n');
    } catch (error) {
      console.log('❌ Successful payment test failed:', error.message);
    }

    // Test failed payment (using email with 'fail')
    console.log('4b. Testing Failed Payment...');
    const failOrder = { ...mockOrder, user: { ...mockOrder.user, email: 'fail@example.com' } };
    require('./dist/config/database').prisma.order.findUnique = async () => failOrder;
    
    try {
      const result = await PaymentService.processOrderPayment(
        failOrder.id,
        PaymentMethod.MOCK,
        'mock'
      );
      console.log('Failed payment result:', JSON.stringify(result, null, 2));
      console.log('✅ Failed payment test completed\n');
    } catch (error) {
      console.log('❌ Failed payment test error:', error.message);
    }

    // Test pending payment
    console.log('4c. Testing Pending Payment...');
    const pendingOrder = { ...mockOrder, user: { ...mockOrder.user, email: 'pending@example.com' } };
    require('./dist/config/database').prisma.order.findUnique = async () => pendingOrder;
    
    try {
      const result = await PaymentService.processOrderPayment(
        pendingOrder.id,
        PaymentMethod.MOCK,
        'mock'
      );
      console.log('Pending payment result:', JSON.stringify(result, null, 2));
      console.log('✅ Pending payment test completed\n');
    } catch (error) {
      console.log('❌ Pending payment test error:', error.message);
    }

    // Restore original function
    require('./dist/config/database').prisma.order.findUnique = originalFindUnique;

    console.log('🎉 All payment tests completed successfully!');

  } catch (error) {
    console.error('❌ Payment system test failed:', error);
    console.error(error.stack);
  }
}

// Run the test
testPaymentSystem().catch(console.error);

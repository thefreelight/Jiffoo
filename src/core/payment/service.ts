import { prisma } from '@/config/database';
import { ProcessPaymentRequest } from './types';

export class PaymentService {
  static async processPayment(userId: string, data: ProcessPaymentRequest) {
    // Verify order belongs to user and is in correct status
    const order = await prisma.order.findFirst({
      where: {
        id: data.orderId,
        userId,
        status: 'PENDING',
      },
    });

    if (!order) {
      throw new Error('Order not found or not eligible for payment');
    }

    // Verify payment amount matches order total
    if (data.paymentDetails.amount !== order.totalAmount) {
      throw new Error('Payment amount does not match order total');
    }

    // Simulate payment processing
    // In a real application, this would integrate with payment providers
    const isPaymentSuccessful = await this.simulatePaymentProcessing(data);

    if (isPaymentSuccessful) {
      // Update order status to PAID
      await prisma.order.update({
        where: { id: data.orderId },
        data: { status: 'PAID' },
      });

      return {
        id: `payment_${Date.now()}`,
        orderId: data.orderId,
        amount: data.paymentDetails.amount,
        status: 'COMPLETED' as const,
        paymentMethod: data.paymentMethod,
        transactionId: `txn_${Date.now()}`,
        createdAt: new Date(),
      };
    } else {
      return {
        id: `payment_${Date.now()}`,
        orderId: data.orderId,
        amount: data.paymentDetails.amount,
        status: 'FAILED' as const,
        paymentMethod: data.paymentMethod,
        createdAt: new Date(),
      };
    }
  }

  private static async simulatePaymentProcessing(data: ProcessPaymentRequest): Promise<boolean> {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate 90% success rate
    return Math.random() > 0.1;
  }

  static async getPaymentStatus(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return {
      orderId: order.id,
      status: order.status,
      amount: order.totalAmount,
      isPaid: order.status === 'PAID',
    };
  }
}

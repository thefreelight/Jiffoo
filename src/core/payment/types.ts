import { z } from 'zod';

export const ProcessPaymentSchema = z.object({
  orderId: z.string(),
  paymentMethod: z.enum(['CREDIT_CARD', 'PAYPAL', 'BANK_TRANSFER']),
  paymentDetails: z.object({
    // This would contain payment-specific details
    // For demo purposes, we'll keep it simple
    amount: z.number().positive(),
  }),
});

export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentSchema>;

export interface PaymentResponse {
  id: string;
  orderId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  paymentMethod: string;
  transactionId?: string;
  createdAt: Date;
}

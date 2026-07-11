/**
 * Payment API - Storefront and core-facing payment endpoints.
 */

import { Router, Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { refundService } from '../services/refund.service';
import { getContext, getPluginConfig } from '../lib/platform-context';

const router = Router();

// POST /create-intent
router.post('/create-intent', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
    const config = getPluginConfig(req.headers as any);

    const { orderId, amount, currency, customerEmail, metadata } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'orderId is required' },
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'amount must be a positive number (in cents)',
        },
      });
    }

    const result = await paymentService.createPaymentIntent(
      ctx.installationId,
      { orderId, amount, currency, customerEmail, metadata },
      config.secretKey
    );

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_ERROR',
        message: error.message || 'Failed to create payment intent',
      },
    });
  }
});

// POST /refund
router.post('/refund', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
    const config = getPluginConfig(req.headers as any);

    if (ctx.caller !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    const { paymentRecordId, amount, reason } = req.body;

    if (!paymentRecordId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'paymentRecordId is required',
        },
      });
    }

    const result = await refundService.createRefund(
      ctx.installationId,
      { paymentRecordId, amount, reason },
      config.secretKey
    );

    return res.json({ success: true, data: result });
  } catch (error: any) {
    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Cannot refund')
        ? 400
        : 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: 'REFUND_ERROR',
        message: error.message || 'Failed to process refund',
      },
    });
  }
});

// GET /methods
router.get('/methods', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      methods: [
        {
          type: 'card',
          name: 'Credit / Debit Card',
          currencies: ['usd'],
          provider: 'stripe',
        },
      ],
    },
  });
});

// GET /payments (admin)
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);

    if (ctx.caller !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;

    const result = await paymentService.listPayments(ctx.installationId, {
      page,
      limit,
      status,
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

// GET /payments/:id (admin)
router.get('/payments/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);

    if (ctx.caller !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }

    const payment = await paymentService.getPayment(
      ctx.installationId,
      req.params.id
    );
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Payment not found' },
      });
    }

    return res.json({ success: true, data: payment });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

// GET /order/:orderId (lookup by order ID)
router.get('/order/:orderId', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
    const payment = await paymentService.getPaymentByOrderId(
      ctx.installationId,
      req.params.orderId
    );
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No payment found for this order' },
      });
    }
    return res.json({ success: true, data: payment });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

export { router as paymentApiRoutes };

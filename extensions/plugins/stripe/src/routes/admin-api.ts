/**
 * Admin API - Dashboard stats, payment management, and refund endpoints.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getStripeStatus } from '../lib/stripe-status';
import { paymentService } from '../services/payment.service';
import { refundService } from '../services/refund.service';
import { getContext, getPluginConfig } from '../lib/platform-context';

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const ctx = getContext(req.headers as any);
  if (ctx.caller !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  }
  next();
}

router.use(requireAdmin);

// GET /status
router.get('/status', (req: Request, res: Response) => {
  const config = getPluginConfig(req.headers as any);
  return res.json({ success: true, data: getStripeStatus(config) });
});

// GET /dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
    const stats = await paymentService.getDashboardStats(ctx.installationId);
    return res.json({ success: true, data: stats });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

// GET /payments
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
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

// GET /payments/:id
router.get('/payments/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
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

// GET /refunds
router.get('/refunds', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const paymentRecordId = req.query.paymentRecordId as string | undefined;
    const result = await refundService.listRefunds(ctx.installationId, {
      page,
      limit,
      paymentRecordId,
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
});

// POST /refund
router.post('/refund', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
    const config = getPluginConfig(req.headers as any);
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
      error: { code: 'REFUND_ERROR', message: error.message },
    });
  }
});

export { router as adminApiRoutes };

/**
 * Session API - Implements the core platform's payment session contract.
 *
 * These routes are mounted at /payments in the Express app so that the
 * core gateway forwarding path matches correctly:
 *
 *   Core calls:  callPaymentPlugin({ path: '/api/payments/create-session' })
 *   Gateway URL: /api/extensions/plugin/stripe/api/payments/create-session
 *   Gateway strips to forwardPath: /payments/create-session
 *   Express matches: app.use('/payments', sessionApiRoutes) -> router.post('/create-session')
 */

import { Router, Request, Response } from 'express';
import { sessionService } from '../services/session.service';
import { getContext, getPluginConfig } from '../lib/platform-context';

const router = Router();

// POST /create-session
// Called by the core payment module to initiate a Checkout Session.
router.post('/create-session', async (req: Request, res: Response) => {
  try {
    const ctx = getContext(req.headers as any);
    const config = getPluginConfig(req.headers as any);

    const { orderId, amount, currency, successUrl, cancelUrl, customerEmail, idempotencyKey, metadata } =
      req.body;

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

    const result = await sessionService.createSession(
      ctx.installationId,
      { orderId, amount, currency, successUrl, cancelUrl, customerEmail, idempotencyKey, metadata },
      config.secretKey,
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_ERROR',
        message: error.message || 'Failed to create payment session',
      },
    });
  }
});

// POST /verify-session
// Called by the core payment module to check session payment status.
router.post('/verify-session', async (req: Request, res: Response) => {
  try {
    const config = getPluginConfig(req.headers as any);
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' },
      });
    }

    const result = await sessionService.verifySession(sessionId, config.secretKey);

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_ERROR',
        message: error.message || 'Failed to verify payment session',
      },
    });
  }
});

export { router as sessionApiRoutes };

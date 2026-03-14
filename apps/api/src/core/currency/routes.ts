/**
 * Currency Routes
 * API endpoints for currency management, exchange rates, and conversions
 */
import { FastifyPluginAsync } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { CurrencyService } from './service';
import { sendSuccess, sendError } from '@/utils/response';
import { ConversionRequestSchema } from './types';

const currencyService = new CurrencyService();

const currencyRoutes: FastifyPluginAsync = async (fastify) => {

    // Public Routes - No authentication required

    // Get list of enabled currencies
    fastify.get('/enabled', async (request, reply) => {
        try {
            const enabledCurrencies = await currencyService.getEnabledCurrencies();
            return sendSuccess(reply, enabledCurrencies);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch enabled currencies');
        }
    });

    // Convert price between currencies
    fastify.get('/convert', async (request, reply) => {
        const { amount, from, to } = request.query as { amount?: string; from?: string; to?: string };

        // Validate query parameters
        if (!amount || !from || !to) {
            return sendError(reply, 400, 'BAD_REQUEST', 'Missing required parameters: amount, from, to');
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return sendError(reply, 400, 'BAD_REQUEST', 'Amount must be a positive number');
        }

        // Validate with schema
        const validation = ConversionRequestSchema.safeParse({
            amount: amountNum,
            fromCurrency: from,
            toCurrency: to
        });

        if (!validation.success) {
            return sendError(reply, 400, 'BAD_REQUEST', validation.error.errors[0].message);
        }

        try {
            const result = await currencyService.convertPrice(amountNum, from, to);
            return sendSuccess(reply, result);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to convert price');
        }
    });

    // Get list of exchange rates (paginated)
    fastify.get('/rates', async (request, reply) => {
        const { page, limit } = request.query as { page?: string; limit?: string };

        const pageNum = page ? parseInt(page) : 1;
        const limitNum = limit ? parseInt(limit) : 50;

        if (isNaN(pageNum) || pageNum < 1) {
            return sendError(reply, 400, 'BAD_REQUEST', 'Invalid page number');
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return sendError(reply, 400, 'BAD_REQUEST', 'Invalid limit (must be between 1 and 100)');
        }

        try {
            const rates = await currencyService.listExchangeRates(pageNum, limitNum);
            return sendSuccess(reply, rates);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch exchange rates');
        }
    });

    // Admin Routes - Require authentication and admin role

    // Update exchange rates from external API
    fastify.post('/rates/update', {
        onRequest: [authMiddleware, requireAdmin]
    }, async (request, reply) => {
        const { baseCurrency } = request.body as { baseCurrency?: string };

        const base = baseCurrency || 'USD';

        if (base.length !== 3) {
            return sendError(reply, 400, 'BAD_REQUEST', 'Currency code must be 3 characters');
        }

        try {
            const updatedCount = await currencyService.updateExchangeRates(base);
            return sendSuccess(reply, {
                updatedCount,
                baseCurrency: base,
                timestamp: new Date().toISOString()
            }, `${updatedCount} exchange rates updated successfully`);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to update exchange rates');
        }
    });

    // Clear currency cache (admin only)
    fastify.post('/cache/clear', {
        onRequest: [authMiddleware, requireAdmin]
    }, async (request, reply) => {
        try {
            await currencyService.clearCache();
            return sendSuccess(reply, { cleared: true }, 'Currency cache cleared successfully');
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to clear cache');
        }
    });
};

export default currencyRoutes;

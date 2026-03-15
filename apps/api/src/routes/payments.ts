import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { StripeService } from '@/services/stripe.service';
import { authMiddleware } from '@/core/auth/middleware';
import { LoggerService } from '@/core/logger/unified-logger';
import { OrderStatus, PaymentStatus } from '@/core/order/types';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { OrderPaymentStatus as PrismaOrderPaymentStatus, OrderStatus as PrismaOrderStatus, Prisma } from '@prisma/client';

// Schema for create-intent request
const CreateIntentSchema = z.object({
    orderId: z.string().min(1),
    idempotencyKey: z.string().min(1).optional(),
});

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * CREATE PAYMENT INTENT
     * Generates a Stripe PaymentIntent for the given order and returns the clientSecret.
     */
    fastify.post('/create-intent', {
        preHandler: authMiddleware,
        schema: {
            tags: ['payments'],
            summary: 'Create Stripe Payment Intent',
            security: [{ bearerAuth: [] }],
                body: {
                    type: 'object',
                    required: ['orderId'],
                    properties: {
                    orderId: { type: 'string' },
                    idempotencyKey: { type: 'string' }
                    }
                }
            }
    }, async (request, reply) => {
        try {
            const { orderId, idempotencyKey: rawIdempotencyKey } = CreateIntentSchema.parse(request.body);

            // Verify order exists and belongs to user
            const order = await prisma.order.findUnique({
                where: { id: orderId }
            });

            if (!order) {
                return reply.status(404).send({ success: false, message: 'Order not found' });
            }

            if (order.userId !== request.user.id) {
                return reply.status(403).send({ success: false, message: 'Forbidden' });
            }

            // Check if order is already paid
            if (order.paymentStatus === 'PAID') {
                return reply.status(400).send({ success: false, message: 'Order is already paid' });
            }

            // Reuse existing pending payment intent if it matches the current total
            // In a real app we would check active Stripe payment Intents, but here we just create a new one every time 
            // or implement logic to search DB for an existing pending intent first under "Payment" table.

            const attemptNumber = (order.paymentAttempts || 0) + 1;
            const normalizedIdempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim()
                ? rawIdempotencyKey.trim()
                : undefined;
            const idempotencyKey = normalizedIdempotencyKey || `order:${order.id}:attempt:${attemptNumber}:stripe`;

            const existingPayment = await prisma.payment.findUnique({
                where: { idempotencyKey },
            });

            if (existingPayment) {
                const existingMeta = (existingPayment.metadata && typeof existingPayment.metadata === 'object')
                    ? existingPayment.metadata as Record<string, unknown>
                    : {};
                const existingClientSecret = typeof existingMeta.clientSecret === 'string' ? existingMeta.clientSecret : null;
                if (!existingClientSecret) {
                    return reply.status(409).send({ success: false, message: 'Idempotency key already used.' });
                }
                return {
                    success: true,
                    clientSecret: existingClientSecret,
                    paymentIntentId: existingPayment.paymentIntentId,
                };
            }

            const { clientSecret, id: paymentIntentId } = await StripeService.createPaymentIntent({
                amount: Number(order.totalAmount),
                currency: order.currency.toLowerCase(),
                orderId: order.id,
                metadata: {
                    userId: request.user.id,
                }
            });

            // Log payment creation attempt
            try {
                await prisma.$transaction(async (tx) => {
                    const payment = await tx.payment.create({
                        data: {
                            orderId: order.id,
                            paymentMethod: 'stripe',
                            paymentIntentId: paymentIntentId,
                            amount: Number(order.totalAmount),
                            currency: order.currency,
                            status: 'PENDING',
                            attemptNumber,
                            idempotencyKey,
                            metadata: {
                                clientSecret,
                            },
                        }
                    });

                    await tx.paymentLedger.create({
                        data: {
                            paymentId: payment.id,
                            orderId: order.id,
                            eventType: 'CREATED',
                            amount: Number(order.totalAmount),
                            currency: order.currency,
                            provider: 'stripe',
                            idempotencyKey,
                        },
                    });

                    await tx.order.update({
                        where: { id: order.id },
                        data: {
                            paymentAttempts: attemptNumber,
                            lastPaymentAttemptAt: new Date(),
                            lastPaymentMethod: 'stripe',
                        },
                    });
                });
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
                    if (existing) {
                        const existingMeta = (existing.metadata && typeof existing.metadata === 'object')
                            ? existing.metadata as Record<string, unknown>
                            : {};
                        const existingClientSecret = typeof existingMeta.clientSecret === 'string' ? existingMeta.clientSecret : null;
                        if (!existingClientSecret) {
                            return reply.status(409).send({ success: false, message: 'Idempotency key already used.' });
                        }
                        return {
                            success: true,
                            clientSecret: existingClientSecret,
                            paymentIntentId: existing.paymentIntentId,
                        };
                    }

                    const existingAttempt = await prisma.payment.findFirst({
                        where: {
                            orderId: order.id,
                            attemptNumber,
                        },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (existingAttempt) {
                        const existingMeta = (existingAttempt.metadata && typeof existingAttempt.metadata === 'object')
                            ? existingAttempt.metadata as Record<string, unknown>
                            : {};
                        const existingClientSecret = typeof existingMeta.clientSecret === 'string' ? existingMeta.clientSecret : null;
                        if (!existingClientSecret) {
                            return reply.status(409).send({ success: false, message: 'Payment attempt already exists.' });
                        }
                        return {
                            success: true,
                            clientSecret: existingClientSecret,
                            paymentIntentId: existingAttempt.paymentIntentId,
                        };
                    }
                }
                throw error;
            }

            return {
                success: true,
                clientSecret,
                paymentIntentId
            };

        } catch (error) {
            LoggerService.logError(error as Error, { context: 'POST /api/payments/create-intent' });
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ success: false, message: 'Invalid request data', errors: error.errors });
            }
            return reply.status(500).send({ success: false, message: error instanceof Error ? error.message : 'Internal Server Error' });
        }
    });

    /**
     * STRIPE WEBHOOK
     * Handles asynchronous webhooks from Stripe regarding payment status.
     */
    fastify.post('/webhook', {
        config: {
            // Must receive raw body to verify Stripe Signature
            rawBody: true
        },
        schema: {
            tags: ['payments'],
            summary: 'Stripe Webhook Listener',
        }
    }, async (request, reply) => {
        const signature = request.headers['stripe-signature'];

        if (!signature) {
            LoggerService.logSystem('Webhook Error: Missing Stripe Signature', {});
            return reply.status(400).send({ error: 'Missing stripe signature' });
        }

        let event;
        try {
            // rawBody is populated by fastify-raw-body plugin in server.ts
            const payload = (request as any).rawBody;

            if (!payload) {
                throw new Error('Raw body is missing. Ensure fastify-raw-body is registered.');
            }

            event = await StripeService.constructWebhookEvent(payload, signature as string);
        } catch (err: any) {
            return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
        }

        // Handle the event
        try {
            switch (event.type) {
                case 'payment_intent.succeeded': {
                    const paymentIntent = event.data.object as any;
                    const orderId = paymentIntent.metadata.orderId;
                    const stripePaymentIntentId = paymentIntent.id;
                    const providerEventId = event.id;

                    if (orderId) {
                        const payment = await prisma.payment.findFirst({
                            where: { paymentIntentId: stripePaymentIntentId },
                        });

                        if (!payment) {
                            LoggerService.logSystem(`Payment not found for Stripe intent ${stripePaymentIntentId}`, {});
                            break;
                        }

                        if (payment.status === 'SUCCEEDED') {
                            break;
                        }

                        const existingLedger = await prisma.paymentLedger.findUnique({
                            where: { providerEventId },
                        });
                        if (existingLedger) {
                            break;
                        }

                        const order = await prisma.order.findUnique({
                            where: { id: orderId },
                            select: { status: true, paymentStatus: true },
                        });

                        await prisma.$transaction(async (tx) => {
                            const updatedPayment = await tx.payment.update({
                                where: { id: payment.id },
                                data: {
                                    status: 'SUCCEEDED',
                                    providerEventId,
                                    updatedAt: new Date(),
                                },
                            });

                            await tx.paymentLedger.create({
                                data: {
                                    paymentId: updatedPayment.id,
                                    orderId,
                                    eventType: 'SUCCEEDED',
                                    amount: updatedPayment.amount,
                                    currency: updatedPayment.currency,
                                    provider: 'stripe',
                                    providerEventId,
                                },
                            });

                            const updatedOrder = await tx.order.update({
                                where: { id: orderId },
                                data: {
                                    status: OrderStatus.PROCESSING, // Move to processing after payment
                                    paymentStatus: PaymentStatus.PAID,
                                    updatedAt: new Date(),
                                },
                            });

                            if (order) {
                                await recordOrderStatusHistory(tx, {
                                    orderId: updatedOrder.id,
                                    fromStatus: order.status as PrismaOrderStatus,
                                    toStatus: updatedOrder.status as PrismaOrderStatus,
                                    fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
                                    toPaymentStatus: updatedOrder.paymentStatus as PrismaOrderPaymentStatus,
                                    reason: 'payment_succeeded',
                                    actorType: 'system',
                                });
                            }
                        });

                        LoggerService.logSystem(`Order ${orderId} successfully paid via Stripe.`, { paymentIntent: stripePaymentIntentId });
                    }
                    break;
                }

                case 'payment_intent.payment_failed': {
                    const paymentIntent = event.data.object as any;
                    const orderId = paymentIntent.metadata.orderId;
                    const stripePaymentIntentId = paymentIntent.id;
                    const failureReason = paymentIntent.last_payment_error?.message || 'Unknown failure';
                    const providerEventId = event.id;

                    if (orderId) {
                        const payment = await prisma.payment.findFirst({
                            where: { paymentIntentId: stripePaymentIntentId },
                        });

                        if (!payment) {
                            LoggerService.logSystem(`Payment not found for Stripe intent ${stripePaymentIntentId}`, {});
                            break;
                        }

                        if (payment.status === 'FAILED') {
                            break;
                        }

                        const existingLedger = await prisma.paymentLedger.findUnique({
                            where: { providerEventId },
                        });
                        if (existingLedger) {
                            break;
                        }

                        const order = await prisma.order.findUnique({
                            where: { id: orderId },
                            select: { status: true, paymentStatus: true },
                        });

                        await prisma.$transaction(async (tx) => {
                            const updatedPayment = await tx.payment.update({
                                where: { id: payment.id },
                                data: {
                                    status: 'FAILED',
                                    failureReason,
                                    providerEventId,
                                    updatedAt: new Date(),
                                },
                            });

                            await tx.paymentLedger.create({
                                data: {
                                    paymentId: updatedPayment.id,
                                    orderId,
                                    eventType: 'FAILED',
                                    amount: updatedPayment.amount,
                                    currency: updatedPayment.currency,
                                    provider: 'stripe',
                                    providerEventId,
                                },
                            });

                            const updatedOrder = await tx.order.update({
                                where: { id: orderId },
                                data: {
                                    paymentStatus: PaymentStatus.FAILED,
                                    updatedAt: new Date(),
                                }
                            });

                            if (order) {
                                await recordOrderStatusHistory(tx, {
                                    orderId: updatedOrder.id,
                                    fromStatus: order.status as PrismaOrderStatus,
                                    toStatus: updatedOrder.status as PrismaOrderStatus,
                                    fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
                                    toPaymentStatus: updatedOrder.paymentStatus as PrismaOrderPaymentStatus,
                                    reason: 'payment_failed',
                                    actorType: 'system',
                                });
                            }
                        });

                        LoggerService.logSystem(`Order ${orderId} failed payment.`, { reason: failureReason });
                    }
                    break;
                }

                default:
                    // Unhandled event type
                    LoggerService.logSystem(`Unhandled event type ${event.type}`, {});
            }

            // Return 200 OK so Stripe marks delivery as successful
            return reply.send({ received: true });

        } catch (err) {
            LoggerService.logError(err as Error, { context: 'Stripe Webhook Processing' });
            // Return 500 so Stripe retries the webhook delivery later
            return reply.status(500).send({ error: 'Webhook processing failed.' });
        }
    });

};

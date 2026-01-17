/**
 * Core Event System Contracts
 * 
 * This file defines the strictly typed event payloads for the Jiffoo Core system.
 * It strictly adheres to the definitions in docs/development/CORE_EVENTS.md.
 */

// --- 1. Standard Envelope ---

export interface JiffooEvent<T = unknown> {
    // Unique Event ID (UUID v4)
    id: string;
    // Event Type (e.g., "order.paid")
    type: string;
    // Aggregate ID (e.g., Order ID, User ID)
    aggregateId: string;
    // Microtimestamp of occurrence
    occurredAt: number;
    // Schema Version for Payload (e.g., "v1")
    version: string;
    // The actual data change
    data: T;
    // Metadata for tracing/causality
    metadata: {
        traceId?: string;
        actorId?: string; // Who triggered this?
        clientIp?: string;
        [key: string]: unknown;
    };
}

// --- 2. User Domain Events ---

export interface UserCreatedPayload {
    id: string;
    email: string;
    username: string;
    role: string;
}

export interface UserUpdatedPayload {
    id: string;
    changes: Record<string, unknown>; // Diff of what changed
}

export interface UserDisabledPayload {
    id: string;
    reason: string;
}

// --- 3. Product Domain Events ---

export interface ProductCreatedPayload {
    id: string;
    title: string;
    price: number;
    sku?: string;
}

export interface ProductUpdatedPayload {
    id: string;
    changes: Record<string, unknown>;
    status: string;
}

export interface ProductStockChangedPayload {
    id: string;
    sku?: string;
    oldStock: number;
    newStock: number;
    delta: number;
    reason?: string;
}

// --- 4. Order Domain Events ---

export interface OrderCreatedPayload {
    id: string;
    userId: string;
    totalAmount: number;
    currency: string;
    items: Array<{
        productId: string;
        variantId: string;
        quantity: number;
        unitPrice: number;
    }>;
}

export interface OrderPaidPayload {
    id: string;
    paymentMethod: string;
    transactionId?: string;
    amount: number;
}

export interface OrderCancelledPayload {
    id: string;
    reason?: string;
    refunded: boolean;
}

export interface OrderShippedPayload {
    id: string;
    trackingNumber: string;
    carrier: string;
}

export interface OrderRefundedPayload {
    id: string;
    amount: number;
    reason?: string;
}

export interface OrderStatusChangedPayload {
    id: string;
    from: string;
    to: string;
}

// --- 5. Payment Domain Events ---

export interface PaymentSessionCreatedPayload {
    id: string;
    orderId: string;
    amount: number;
    provider: string;
}

export interface PaymentWebhookProcessedPayload {
    id: string;
    provider: string;
    status: string;
    rawPayload: unknown; // Sanitized payload
}

// --- 6. Union Type for All Events ---

export type CoreEvent =
    | JiffooEvent<UserCreatedPayload> & { type: 'user.created' }
    | JiffooEvent<UserUpdatedPayload> & { type: 'user.updated' }
    | JiffooEvent<UserDisabledPayload> & { type: 'user.disabled' }
    | JiffooEvent<ProductCreatedPayload> & { type: 'product.created' }
    | JiffooEvent<ProductUpdatedPayload> & { type: 'product.updated' }
    | JiffooEvent<ProductStockChangedPayload> & { type: 'product.stock_changed' }
    | JiffooEvent<OrderCreatedPayload> & { type: 'order.created' }
    | JiffooEvent<OrderPaidPayload> & { type: 'order.paid' }
    | JiffooEvent<OrderCancelledPayload> & { type: 'order.cancelled' }
    | JiffooEvent<OrderShippedPayload> & { type: 'order.shipped' }
    | JiffooEvent<OrderRefundedPayload> & { type: 'order.refunded' }
    | JiffooEvent<OrderStatusChangedPayload> & { type: 'order.status_changed' }
    | JiffooEvent<PaymentSessionCreatedPayload> & { type: 'payment.session_created' }
    | JiffooEvent<PaymentWebhookProcessedPayload> & { type: 'payment.webhook_processed' };

/**
 * Helper definitions for Event Types keys
 */
export const EventTypes = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DISABLED: 'user.disabled',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_STOCK_CHANGED: 'product.stock_changed',
    ORDER_CREATED: 'order.created',
    ORDER_PAID: 'order.paid',
    ORDER_CANCELLED: 'order.cancelled',
    ORDER_SHIPPED: 'order.shipped',
    ORDER_REFUNDED: 'order.refunded',
    ORDER_STATUS_CHANGED: 'order.status_changed',
    PAYMENT_SESSION_CREATED: 'payment.session_created',
    PAYMENT_WEBHOOK_PROCESSED: 'payment.webhook_processed',
} as const;

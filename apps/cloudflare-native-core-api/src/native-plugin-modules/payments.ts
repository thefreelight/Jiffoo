import { NATIVE_PLUGIN_MODULES } from './registry';
import type { NativePluginModule } from './runtime';

/**
 * The payment composition points of native plugin modules. A module that takes money on a page
 * of its own (a gateway's checkout) describes how through `payments`, and the core does the rest
 * the same way for every module: keeps the session, brings the shopper back, settles the order
 * once, and books refunds. The open-source build compiles no module in, so nothing here finds one.
 */

/**
 * What the module needs to open its checkout page. `notifyUrl` is the public address of this
 * store's webhook route for the module; `successUrl` is an absolute https address that names the
 * session the core keeps, so the page the shopper returns to can ask about the order.
 */
export interface NativePaymentCharge {
  orderId: string;
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string | null;
  notifyUrl: string;
  buyerEmail: string | null;
  idempotencyKey: string;
}

export interface NativePaymentCheckout {
  /** The gateway's own id for the checkout, kept on the session row. */
  providerSessionId: string | null;
  url: string;
  expiresAt: string | null;
}

/** What the module finds when asked directly about a session. */
export interface NativePaymentFact {
  status: 'succeeded' | 'failed' | 'pending';
  paymentId: string | null;
}

export type NativePaymentNotice =
  | {
    kind: 'payment';
    status: 'succeeded' | 'failed';
    eventId: string;
    /** Empty when the delivery names no order; `providerSessionId` is a second way to one. */
    orderId: string;
    paymentId: string | null;
    providerSessionId: string | null;
    /** The amount actually taken, when the delivery says; null when it does not. */
    amountMinor: number | null;
    /** The currency the amount is in, when the delivery says. */
    currency: string | null;
  }
  | {
    kind: 'refund';
    status: 'succeeded' | 'failed';
    eventId: string;
    orderId: string;
    paymentId: string | null;
    /** The reference this store gave the refund when it asked for it. */
    refundReference: string | null;
    refundId: string | null;
    amountMinor: number | null;
  }
  | { kind: 'ignored'; eventId: string };

export interface NativePaymentRefundResult {
  outcome: 'succeeded' | 'failed' | 'pending';
  providerRefundId: string | null;
}

export type NativePaymentCode =
  | 'GATEWAY_REJECTED'
  | 'INVALID_WEBHOOK'
  | 'NOT_CONFIGURED'
  | 'CURRENCY_UNSUPPORTED'
  | 'INVALID_ORDER_TOTAL'
  | 'REFUND_UNSUPPORTED';

/** What a module throws when it cannot do what the core asked. */
export class NativePaymentError extends Error {
  constructor(message: string, readonly code: NativePaymentCode = 'GATEWAY_REJECTED') {
    super(message);
    this.name = 'NativePaymentError';
  }
}

export interface NativePaymentMethod {
  /** The module's slug: what the storefront sends back as `paymentMethod`. */
  name: string;
  displayName: string;
  icon: string;
  supportedCurrencies: string[];
  isLive: boolean;
  clientConfig: Record<string, unknown>;
}

export interface NativePluginModulePayments {
  /**
   * Opens the module's checkout page for the order total. `settings` are the plugin's settings
   * as the administrator saved them, secrets decrypted.
   */
  createCheckout(settings: Record<string, unknown>, charge: NativePaymentCharge): Promise<NativePaymentCheckout>;
  /** Asks the module directly what became of a session; null when it has nothing to say yet. */
  lookup(settings: Record<string, unknown>, session: { orderId: string; providerSessionId: string | null }): Promise<NativePaymentFact | null>;
  /**
   * Verifies a delivery to the webhook route and reads what it says. It throws
   * `NativePaymentError` for any delivery that cannot be verified: nothing it says is trusted then.
   */
  readWebhook(settings: Record<string, unknown>, delivery: { rawBody: string; headers: Record<string, string> }): Promise<NativePaymentNotice>;
  /**
   * `text` answers a verified delivery with the bare body `success`, for modules whose gateway
   * takes anything else as a failed delivery. The default is the core's JSON envelope.
   */
  webhookAck?: 'json' | 'text';
  /** Asks the module to return part or all of a payment. Absent for a method that cannot return money by itself. */
  createRefund?(
    settings: Record<string, unknown>,
    input: { paymentId: string; amountMinor: number; currency: string; reason: string | null; reference: string },
  ): Promise<NativePaymentRefundResult>;
  /**
   * What the module says about a refund it had not confirmed when it was asked for; null while
   * it has nothing to say yet.
   */
  refundOutcome?(
    settings: Record<string, unknown>,
    refund: { reference: string; providerRefundId: string | null },
  ): Promise<'succeeded' | 'failed' | 'pending' | null>;
}

export type NativePaymentModule = NativePluginModule & { payments: NativePluginModulePayments };

/** The module that takes payments under this slug, when the build compiled one in. */
export function nativePaymentModule(id: unknown): NativePaymentModule | null {
  if (typeof id !== 'string') return null;
  return NATIVE_PLUGIN_MODULES.find((module): module is NativePaymentModule => module.id === id && Boolean(module.payments)) ?? null;
}

export function nativePaymentModules(): NativePaymentModule[] {
  return NATIVE_PLUGIN_MODULES.filter((module): module is NativePaymentModule => Boolean(module.payments));
}

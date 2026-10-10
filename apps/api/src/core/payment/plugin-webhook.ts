import type { PaymentFact } from '@jiffoo/shared';
import { observePaymentFact } from './observations';

export function applyNormalizedPluginWebhook(pluginSlug: string, fact: PaymentFact): Promise<boolean> {
  return observePaymentFact(pluginSlug, fact, 'webhook');
}

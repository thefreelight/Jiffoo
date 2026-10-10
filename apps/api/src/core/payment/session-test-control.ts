import { AsyncLocalStorage } from 'node:async_hooks';
const controls = new AsyncLocalStorage<(paymentId: string) => Promise<void>>();
export function withPaymentSessionTestControl<T>(enabled: boolean, reserved: (paymentId: string) => Promise<void>, run: () => T): T {
  if (!enabled || process.env.NODE_ENV !== 'test') throw new Error('Payment session controls require an explicit test switch');
  return controls.run(reserved, run);
}
export async function observePaymentReservationForTest(paymentId: string): Promise<void> {
  const observer = controls.getStore();
  if (observer && process.env.NODE_ENV !== 'test') throw new Error('Payment session controls are not permitted outside tests');
  await observer?.(paymentId);
}

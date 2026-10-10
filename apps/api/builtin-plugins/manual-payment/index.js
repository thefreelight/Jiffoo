/** @param {import('@jiffoo/shared').PluginContext} ctx */
function register(ctx) {
  const instructions = typeof ctx.config.instructions === 'string' && ctx.config.instructions.trim() ? ctx.config.instructions : 'Pay manually.';
  const configuredHours = ctx.config.unpaidTimeoutHours;
  const hours = typeof configuredHours === 'number' && Number.isInteger(configuredHours) && configuredHours >= 1 && configuredHours <= 720 ? configuredHours : 72;
  const account = { namespace: 'jiffoo-manual', merchantAccount: 'store', environment: 'live' };
  ctx.contracts.implement('payment', 2, {
    describe: raw => {
      const input = /** @type {import('@jiffoo/shared').PaymentV2Input<'describe'>} */ (raw);
      return { displayName: 'Manual payment', requiresManualConfirmation: true, unpaidTimeoutMinutes: hours * 60, supportedCurrencies: [input.storeCurrency], instructions, account };
    },
    createSession: raw => {
      const input = /** @type {import('@jiffoo/shared').PaymentV2Input<'createSession'>} */ (raw);
      // Manual session issuance is a pure function: it sends no external creation request.
      return { account, requestKey: input.idempotencyKey, sessionId: 'manual_' + input.orderId + '_' + input.idempotencyKey,
        amountMinor: input.amountMinor, currency: input.currency, observedAt: new Date().toISOString(), status: 'pending',
        action: { type: 'instructions', text: instructions }, captures: [], canStillBeCharged: true, requestClosed: false };
    },
    queryByRequestKey: raw => {
      const input = /** @type {import('@jiffoo/shared').PaymentV2Input<'queryByRequestKey'>} */ (raw);
      const expired = Date.now() >= new Date(input.request.expiresAt).getTime();
      // Core owns manual receipts and the durable reservation; no PSP-side capture is hidden.
      return { account, requestKey: input.requestKey, sessionId: 'manual_' + input.request.orderId + '_' + input.requestKey,
        amountMinor: input.request.amountMinor, currency: input.request.currency, observedAt: new Date().toISOString(),
        status: input.request.knownCaptures.length ? 'succeeded' : expired ? 'expired' : 'pending',
        action: { type: 'instructions', text: instructions }, captures: input.request.knownCaptures, canStillBeCharged: !expired, requestClosed: expired };
    },
    handleWebhook: () => ({ verification: 'rejected', reasonCode: 'WEBHOOK_NOT_SUPPORTED' }),
  });
}
module.exports = { register };

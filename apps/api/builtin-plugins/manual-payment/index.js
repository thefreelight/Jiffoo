/** @param {import('@jiffoo/shared').PluginContext} ctx */
function register(ctx) {
  const instructions = typeof ctx.config.instructions === 'string' ? ctx.config.instructions : 'Pay manually.';
  const configuredHours = ctx.config.unpaidTimeoutHours;
  const hours = typeof configuredHours === 'number' && Number.isInteger(configuredHours) && configuredHours >= 1 && configuredHours <= 720 ? configuredHours : 72;
  ctx.contracts.implement('payment', 1, {
    describe: (input) => {
      const request = /** @type {{ storeCurrency?: unknown }} */ (input);
      const storeCurrency = typeof request.storeCurrency === 'string' ? request.storeCurrency : 'USD';
      return { displayName: 'Manual payment', requiresManualConfirmation: true, unpaidTimeoutMinutes: hours * 60, supportedCurrencies: [storeCurrency], instructions };
    },
    createSession: (input) => {
      const request = /** @type {{ orderId?: unknown, idempotencyKey?: unknown }} */ (input);
      return { sessionId: `manual_${String(request.orderId)}_${String(request.idempotencyKey)}`, action: { type: 'instructions', text: instructions } };
    },
    getSessionStatus: () => ({ status: 'pending' }),
  });
}
module.exports = { register };

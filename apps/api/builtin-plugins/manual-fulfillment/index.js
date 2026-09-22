/** @param {import('@jiffoo/shared').PluginContext} ctx */
function register(ctx) {
  ctx.contracts.implement('fulfillment', 1, { createFulfillment: (input) => {
    const request = /** @type {{ orderId?: unknown, idempotencyKey?: unknown }} */ (input);
    return { fulfillmentId: `manual_${String(request.orderId)}_${String(request.idempotencyKey)}`, status: 'pending' };
  } });
}
module.exports = { register };

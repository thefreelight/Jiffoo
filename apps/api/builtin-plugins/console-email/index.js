/** @param {import('@jiffoo/shared').PluginContext} ctx */
function register(ctx) {
  ctx.contracts.implement('notification', 2, { send: (input) => {
    const request = /** @type {{ to?: unknown, subject?: unknown, text?: unknown, idempotencyKey?: unknown }} */ (input);
    ctx.logger.info('Console email', { to: request.to, subject: request.subject, text: request.text });
    return { outcome: 'accepted', providerMessageId: `console_${String(request.idempotencyKey)}` };
  } });
}
module.exports = { register };

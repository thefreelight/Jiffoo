/** @param {import('@jiffoo/shared').PluginContext} ctx */
function register(ctx) { const label = typeof ctx.config.label === 'string' ? ctx.config.label : 'Free shipping'; ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'free', label, amountMinor: 0 }] }) }); }
module.exports = { register };

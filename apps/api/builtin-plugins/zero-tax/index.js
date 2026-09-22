/** @param {import('@jiffoo/shared').PluginContext} ctx */
function register(ctx) {
  ctx.contracts.implement('tax', 1, { calculate: (input) => {
    const request = /** @type {{ lines?: Array<{ lineId?: unknown }> }} */ (input);
    return { pricesIncludeTax: false, lines: (request.lines ?? []).map((line) => ({ lineId: String(line.lineId), taxMinor: 0 })), shippingTaxMinor: 0, totalTaxMinor: 0 };
  } });
}
module.exports = { register };

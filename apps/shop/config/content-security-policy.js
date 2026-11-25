/**
 * Content-Security-Policy of the storefront.
 *
 * The policy is fixed at build time, so a deployment that embeds third-party
 * content declares the extra origins it needs when it is built:
 *
 *   SHOP_CSP_EXTRA_SCRIPT_SRC="https://pagead2.googlesyndication.com"
 *   SHOP_CSP_EXTRA_FRAME_SRC="https://html5.gamemonetize.co https://googleads.g.doubleclick.net"
 *
 * Both take space-separated https origins — a bare host, with no path, wildcard
 * or other scheme. Anything else in the value is dropped, and a deployment that
 * sets neither gets the unchanged default policy.
 */

/** Normalizes a space-separated origin list to a CSP fragment with a leading space per origin. */
function cspOrigins(value) {
  if (!value) return '';
  const origins = [];
  for (const token of String(value).split(/\s+/)) {
    if (!token) continue;
    if (!/^https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(token)) continue;
    if (!origins.includes(token)) origins.push(token);
  }
  return origins.map((origin) => ` ${origin}`).join('');
}

function buildContentSecurityPolicy({ development = false, extraScriptSrc = '', extraFrameSrc = '' } = {}) {
  const scriptSrc = `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com${development ? ' https://unpkg.com' : ''}${cspOrigins(extraScriptSrc)}`;
  const frameSrc = `frame-src 'self' https://js.stripe.com https://hooks.stripe.com${cspOrigins(extraFrameSrc)}`;
  // react-scan (dev-only perf overlay) spawns a blob: worker; allowed only in
  // development — prod CSP stays strict.
  const workerSrc = development ? " worker-src 'self' blob:;" : '';
  return `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http:; ${frameSrc};${workerSrc} frame-ancestors 'none';`;
}

module.exports = { buildContentSecurityPolicy, cspOrigins };

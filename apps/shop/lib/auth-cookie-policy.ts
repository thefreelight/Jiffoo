/**
 * Session cookie scope for this storefront deployment.
 *
 * By default the access token is mirrored into a cookie scoped to the site
 * family (`Domain=bokmoo.com` from `esim.bokmoo.com`) so sibling subdomains
 * share one session. That cookie is script-readable from every host under the
 * family domain. A storefront that serves code it does not control on a
 * sibling subdomain — a portal embedding third-party games on
 * `games.example.com` — sets `NEXT_PUBLIC_AUTH_PARENT_DOMAIN_COOKIE=0` and
 * keeps the session in this host's localStorage only.
 */
export function parentDomainAuthCookieEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_PARENT_DOMAIN_COOKIE !== '0';
}

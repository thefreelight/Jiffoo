/**
 * Deployment-level pattern redirects for retired URL shapes.
 *
 * The storefront redirect store matches exact paths and caps its list, so it
 * cannot carry a thousand per-item URLs when a site moves — say — `/game/<id>`
 * to `/games/<id>`. `SHOP_LEGACY_REDIRECTS` holds a few patterns instead:
 *
 *   SHOP_LEGACY_REDIRECTS="/game/:id=/games/:id;/picks=/games?pick=1"
 *
 * Each pair is `oldPath=newPath`; `:name` matches one path segment and is
 * carried into the target. Only locale-less paths are rewritten (a localized
 * path is already final) and the target gets the store's default locale, so a
 * legacy URL lands on its page with a single 301. The query string is kept.
 */

export interface LegacyRedirectRule {
  pattern: RegExp;
  names: string[];
  target: string;
}

const PARAM_SEGMENT = /^:[A-Za-z][A-Za-z0-9_]*$/;

function literal(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseLegacyRedirectRules(raw: string | undefined | null): LegacyRedirectRule[] {
  if (!raw) return [];
  const rules: LegacyRedirectRule[] = [];
  for (const pair of raw.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const from = pair.slice(0, separator).trim();
    const to = pair.slice(separator + 1).trim();
    // Both sides are absolute paths on this host; anything else is ignored.
    if (!from.startsWith('/') || !to.startsWith('/') || to.startsWith('//')) continue;
    const names: string[] = [];
    const source = from
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        if (PARAM_SEGMENT.test(segment)) {
          names.push(segment.slice(1));
          return '([^/]+)';
        }
        return literal(segment);
      })
      .join('/');
    if (source) rules.push({ pattern: new RegExp(`^/${source}/?$`), names, target: to });
  }
  return rules;
}

/** The localized target for a retired path, or null when no rule matches. */
export function legacyRedirectTarget(rules: LegacyRedirectRule[], pathname: string, locale: string): string | null {
  for (const rule of rules) {
    const match = rule.pattern.exec(pathname);
    if (!match) continue;
    let target = rule.target;
    rule.names.forEach((name, index) => {
      const value = decodeURIComponent(match[index + 1]);
      target = target.split(`:${name}`).join(encodeURIComponent(value));
    });
    return `/${locale}${target}`;
  }
  return null;
}

/**
 * The partner account every storefront account has by default, and how an account that arrives through
 * somebody's link joins that somebody's organization.
 *
 * The owner's direction (2026-11-27): "用户注册默认就要给他开通" — an account is a partner from the start,
 * with a code of its own — and "他链接注册的用户，成交以后，默认还给他返5%": an account that registers
 * through the link of a partner who belongs to an organization joins it, so the organization earns its
 * share when that member's own sales are paid. Kept apart from auth.ts and affiliate.ts, which must not
 * import each other.
 */

interface AffiliateOpenEnv { DB: D1Database }

export interface AffiliateOpenUser {
  id: string;
  email: string;
  username: string;
}

/** The commission of a partner account opened by default, in percent of what the store pays commission on. */
export const DEFAULT_PARTNER_COMMISSION = 10;

/**
 * The organization's share of its members' sales when the store sets none, in percent.
 * The owner (2026-11-27): "成交以后，默认还给他返5%".
 */
export const DEFAULT_ORGANIZATION_COMMISSION = 5;

export function newAffiliateCode(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
}

export async function affiliatePartnerIdOf(env: AffiliateOpenEnv, userId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT id FROM native_affiliate_partners WHERE user_id = ?1').bind(userId).first<{ id: string }>();
  return row?.id ?? null;
}

/**
 * Opens the partner account of an account that has none, and returns the partner's id: the standard
 * commission, no buyer discount until the store sets one, a code of its own. Never throws — an account
 * that cannot get its partner row is still an account; the row is opened the next time it is asked for.
 */
export async function openNativeAffiliatePartner(env: AffiliateOpenEnv, user: AffiliateOpenUser): Promise<string | null> {
  const existing = await affiliatePartnerIdOf(env, user.id);
  if (existing) return existing;
  const now = new Date().toISOString();
  // a code is ten hexadecimal characters: a clash with an older code is rare, and tried once more
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare(
        `INSERT INTO native_affiliate_partners
          (id, user_id, code, status, display_name, email, commission_rate, currency, organization_id, member_role, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'active', ?4, ?5, ?6, 'USD', NULL, NULL, ?7, ?7)`,
      ).bind(id, user.id, newAffiliateCode(), user.username.trim().slice(0, 120) || null, user.email.trim().toLowerCase() || null, DEFAULT_PARTNER_COMMISSION, now).run();
      return id;
    } catch {
      // the row exists by now, or the code was taken: look once more before trying again
      const raced = await affiliatePartnerIdOf(env, user.id);
      if (raced) return raced;
    }
  }
  console.error(JSON.stringify({ message: 'Affiliate partner account could not be opened', userId: user.id }));
  return null;
}

export type ReferrerJoin = 'joined' | 'already' | 'none';

/**
 * Puts an account that registered through a partner's link into that partner's organization, as a
 * member. Nothing happens when the partner belongs to no organization, when the account is the
 * organization's owner itself, or when it already belongs to one: a link never moves an account
 * out of an organization.
 */
export async function joinReferrerOrganization(
  env: AffiliateOpenEnv,
  input: { user: AffiliateOpenUser; referrerPartnerId: string },
): Promise<ReferrerJoin> {
  const referrer = await env.DB.prepare('SELECT organization_id, user_id FROM native_affiliate_partners WHERE id = ?1')
    .bind(input.referrerPartnerId).first<{ organization_id: string | null; user_id: string }>();
  if (!referrer) return 'none';
  // A partner whose account is in an organization is in it, even when the account was opened before the
  // two were tied together: the account decides, and the partner's row is brought up to date.
  let organizationId = referrer.organization_id;
  if (!organizationId) {
    const own = await env.DB.prepare(
      `SELECT organizations.id FROM native_affiliate_organizations organizations
       LEFT JOIN native_affiliate_org_members members
         ON members.organization_id = organizations.id AND members.user_id = ?1 AND members.status = 'active'
       WHERE organizations.status = 'active'
         AND (organizations.owner_user_id = ?1 OR members.user_id IS NOT NULL)
       ORDER BY organizations.created_at DESC LIMIT 1`,
    ).bind(referrer.user_id).first<{ id: string }>();
    if (!own) return 'none';
    organizationId = own.id;
    await env.DB.prepare('UPDATE native_affiliate_partners SET organization_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2')
      .bind(organizationId, input.referrerPartnerId).run();
  }
  const organization = await env.DB.prepare("SELECT owner_user_id FROM native_affiliate_organizations WHERE id = ?1 AND status = 'active'")
    .bind(organizationId).first<{ owner_user_id: string }>();
  // the owner is not a member of their own organization
  if (!organization || organization.owner_user_id === input.user.id) return 'none';
  const membership = await env.DB.prepare("SELECT id FROM native_affiliate_org_members WHERE user_id = ?1 AND status = 'active' LIMIT 1")
    .bind(input.user.id).first<{ id: string }>();
  if (membership) return 'already';
  const partnerId = await openNativeAffiliatePartner(env, input.user);
  if (!partnerId) return 'none';
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO native_affiliate_org_members (id, organization_id, user_id, role, status, joined_at)
         VALUES (?1, ?2, ?3, 'INFLUENCER', 'active', ?4)`,
      ).bind(crypto.randomUUID(), organizationId, input.user.id, now),
      env.DB.prepare(
        `UPDATE native_affiliate_partners SET organization_id = ?1, member_role = 'INFLUENCER', updated_at = ?2 WHERE id = ?3`,
      ).bind(organizationId, now, partnerId),
    ]);
  } catch {
    // two requests raced: the account is a member by now
    return 'already';
  }
  return 'joined';
}

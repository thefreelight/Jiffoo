import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { fetchBossEsimAssets } from './boss-upstream';

/**
 * eSIM asset library reads (eSIM reuse design).
 *
 * GET /api/v1/esims — authenticated. Returns the buyer's provisioned eSIM
 * assets (ICCID registry kept on the BOSS platform) so the checkout can
 * offer "add to my existing eSIM" instead of always paying a fresh
 * provisioning fee. The BOSS key stays server-side; the customer key is
 * the account email, which is exactly the `customerName` the fulfillment
 * hook already sends to BOSS.
 */

type EsimAssetsEnv = NativeAuthEnv & { BOSS_API_KEY?: string; BOSS_BASE_URL?: string };

export async function tryNativeEsimAssets(request: Request, env: EsimAssetsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/esims') return null;
  if (request.method !== 'GET') return null;
  if (!env.BOSS_API_KEY) {
    return Response.json({ success: true, data: { items: [] } });
  }
  const user = await authenticateNativeUser(request, env);
  if (!user) {
    return Response.json({
      success: false,
      error: { code: '1101', message: 'Authentication required' },
    }, { status: 401 });
  }

  const items = await fetchBossEsimAssets(env, user.email);
  return Response.json({ success: true, data: { items } });
}

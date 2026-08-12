import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv } from './auth';

type Env = NativeAuthEnv & Pick<Cloudflare.Env, 'DB'>;
const grantBase = '/api/v1/plugins/remoteradar-applications/store/applications/';
const redirectBase = '/api/v1/remoteradar/external-apply/';
const b64 = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); };
async function hash(value: string): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return b64(new Uint8Array(digest)); }
function error(code: string, message: string, status: number) { return Response.json({ success: false, error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } }); }
async function body(request: Request) { return request.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>)); }

export async function tryNativeRemoteRadarExternalApply(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname.startsWith(redirectBase) && request.method === 'GET') {
    const token = url.pathname.slice(redirectBase.length);
    if (!token || token.length > 256) return error('INVALID_APPLY_GRANT', 'Invalid application grant', 400);
    const tokenHash = await hash(token); const now = new Date().toISOString();
    const grant = await env.DB.prepare('SELECT target_url FROM remoteradar_external_apply_grants WHERE token_hash = ?1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?2').bind(tokenHash, now).first<{ target_url: string }>();
    if (!grant?.target_url) return error('APPLY_GRANT_NOT_FOUND', 'Application link was not found', 404);
    const claimed = await env.DB.prepare('UPDATE remoteradar_external_apply_grants SET used_at = ?1 WHERE token_hash = ?2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?1').bind(now, tokenHash).run();
    if (Number(claimed.meta?.changes ?? 0) !== 1) return error('APPLY_GRANT_EXPIRED', 'This application link has expired, was revoked, or was already used', 410);
    return Response.redirect(grant.target_url, 302);
  }
  const adminPath = '/api/v1/admin/remoteradar/job-targets';
  if (url.pathname === adminPath && request.method === 'POST') {
    const admin = await authenticateNativeAdmin(request, env); if (!admin) return error('UNAUTHORIZED', 'Admin authentication required', 401);
    const input = await body(request); const jobKey = typeof input.jobKey === 'string' ? input.jobKey.trim() : ''; const targetUrl = typeof input.targetUrl === 'string' ? input.targetUrl.trim() : '';
    let parsed: URL; try { parsed = new URL(targetUrl); } catch { return error('INVALID_TARGET_URL', 'targetUrl must be a valid HTTPS URL', 400); }
    if (!jobKey || jobKey.length > 240 || parsed.protocol !== 'https:') return error('INVALID_TARGET_URL', 'targetUrl must be a valid HTTPS URL', 400);
    await env.DB.prepare(`INSERT INTO remoteradar_job_targets (job_key,target_url,updated_by,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(job_key) DO UPDATE SET target_url=excluded.target_url,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(jobKey, targetUrl, admin.id, new Date().toISOString()).run();
    return Response.json({ success: true, data: { jobKey, configured: true } }, { status: 201 });
  }
  if (!url.pathname.startsWith(grantBase)) return null;
  const match = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/applications\/([^/]+)\/external-apply-grants$/);
  if (!match || request.method !== 'POST') return null;
  const user = await authenticateNativeUser(request, env); if (!user) return error('UNAUTHORIZED', 'Login required', 401);
  const applicationId = decodeURIComponent(match[1]!);
  const application = await env.DB.prepare(`SELECT a.id, a.pack_version_id, p.approved_version_id, s.id AS job_id, s.job_key
    FROM native_rr_job_applications a JOIN native_rr_application_packs p ON p.id=a.pack_id JOIN native_rr_saved_jobs s ON s.id=a.saved_job_id
    WHERE a.id=?1 AND a.user_id=?2`).bind(applicationId, user.id).first<{ id: string; pack_version_id: string; approved_version_id: string | null; job_id: string; job_key: string }>();
  if (!application) return error('APPLICATION_NOT_FOUND', 'Application was not found', 404);
  if (!application.approved_version_id || application.approved_version_id !== application.pack_version_id) return error('PACK_APPROVAL_REQUIRED', 'Approve the application pack version before continuing', 409);
  const target = await env.DB.prepare('SELECT target_url FROM remoteradar_job_targets WHERE job_key=?1').bind(application.job_key).first<{ target_url: string }>();
  if (!target) return error('EXTERNAL_APPLY_UNAVAILABLE', 'This application can only be completed inside RemoteRadar', 409);
  const raw = b64(crypto.getRandomValues(new Uint8Array(32))); const now = new Date(); const expires = new Date(now.getTime() + 10 * 60_000).toISOString();
  const reason = 'Application must be completed on an external ATS';
  await env.DB.prepare('INSERT INTO remoteradar_external_apply_grants (id,user_id,application_id,job_id,application_pack_version_id,target_category,reason,token_hash,target_url,expires_at,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)').bind(crypto.randomUUID(), user.id, applicationId, application.job_id, application.pack_version_id, 'external_ats', reason, await hash(raw), target.target_url, expires, now.toISOString()).run();
  return Response.json({ success: true, data: { redirectUrl: `${url.origin}${redirectBase}${raw}`, expiresAt: expires, singleUse: true, targetCategory: 'external_ats', reason } }, { status: 201, headers: { 'cache-control': 'no-store' } });
}

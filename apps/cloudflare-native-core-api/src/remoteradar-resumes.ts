import { authenticateNativeUser, type NativeAuthEnv } from './auth';

type Env = NativeAuthEnv & Pick<Cloudflare.Env, 'DB' | 'ASSETS'>;
const base = '/api/v1/plugins/remoteradar-applications/store/resumes';
const allowed = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']);
function fail(code: string, message: string, status = 400) { return Response.json({ success: false, error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } }); }
function item(row: Record<string, unknown>) { return { id: row.id, resumeId: row.resume_id, filename: row.filename, contentType: row.content_type, byteSize: row.byte_size, extractionStatus: row.extraction_status, createdAt: row.created_at, updatedAt: row.updated_at }; }

export async function tryNativeRemoteRadarResumeDocuments(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url); if (!url.pathname.startsWith(`${base}/`)) return null;
  const user = await authenticateNativeUser(request, env); if (!user) return fail('UNAUTHORIZED', 'Login required', 401);
  const listMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/documents$/);
  if (listMatch && request.method === 'GET') {
    const resumeId = decodeURIComponent(listMatch[1]!); const owned = await env.DB.prepare('SELECT id FROM native_rr_resumes WHERE id=?1 AND user_id=?2').bind(resumeId, user.id).first(); if (!owned) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const rows = await env.DB.prepare('SELECT * FROM remoteradar_resume_documents WHERE resume_id=?1 AND user_id=?2 ORDER BY created_at DESC').bind(resumeId, user.id).all<Record<string, unknown>>(); return Response.json({ success: true, data: rows.results.map(item) }, { headers: { 'cache-control': 'no-store' } });
  }
  if (listMatch && request.method === 'POST') {
    const resumeId = decodeURIComponent(listMatch[1]!); const owned = await env.DB.prepare('SELECT id FROM native_rr_resumes WHERE id=?1 AND user_id=?2').bind(resumeId, user.id).first(); if (!owned) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const form = await request.formData().catch(() => null); const file = form?.get('file'); if (!(file instanceof File)) return fail('FILE_REQUIRED', 'Upload a resume file');
    if (!allowed.has(file.type)) return fail('UNSUPPORTED_FILE_TYPE', 'Only PDF, DOCX, and TXT resumes are supported'); if (file.size <= 0 || file.size > 8 * 1024 * 1024) return fail('FILE_TOO_LARGE', 'Resume files must be between 1 byte and 8 MB');
    const id = crypto.randomUUID(); const key = `private/resumes/${user.id}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const now = new Date().toISOString();
    await env.ASSETS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    await env.DB.prepare(`INSERT INTO remoteradar_resume_documents (id,user_id,resume_id,object_key,filename,content_type,byte_size,extraction_status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8,?8)`).bind(id, user.id, resumeId, key, file.name.slice(0, 240), file.type, file.size, now).run();
    return Response.json({ success: true, data: item({ id, resume_id: resumeId, filename: file.name.slice(0, 240), content_type: file.type, byte_size: file.size, extraction_status: 'pending', created_at: now, updated_at: now }) }, { status: 201, headers: { 'cache-control': 'no-store' } });
  }
  return fail('NOT_FOUND', 'Resume document route was not found', 404);
}

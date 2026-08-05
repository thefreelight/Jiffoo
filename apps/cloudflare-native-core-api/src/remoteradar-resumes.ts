import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { buildResumeFactCandidates, extractResumeDocumentText } from './resume-extraction';

type Env = NativeAuthEnv & Pick<Cloudflare.Env, 'DB' | 'ASSETS'>;
const base = '/api/v1/plugins/remoteradar-applications/store/resumes';
const allowed = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']);
function fail(code: string, message: string, status = 400) { return Response.json({ success: false, error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } }); }
function item(row: Record<string, unknown>) { return { id: row.id, resumeId: row.resume_id, filename: row.filename, contentType: row.content_type, byteSize: row.byte_size, extractionStatus: row.extraction_status, createdAt: row.created_at, updatedAt: row.updated_at }; }

type DocumentRow = { id: string; user_id: string; resume_id: string; object_key: string; content_type: string };

async function processDocument(env: Env, document: DocumentRow): Promise<void> {
  const claimed = await env.DB.prepare("UPDATE remoteradar_resume_documents SET extraction_status='processing', extraction_attempts=extraction_attempts+1, extraction_error=NULL, updated_at=?2 WHERE id=?1 AND extraction_status IN ('pending','failed') AND extraction_attempts < 3").bind(document.id, new Date().toISOString()).run();
  if (!claimed.meta.changes) return;
  try {
    const object = await env.ASSETS.get(document.object_key);
    if (!object) throw new Error('RESUME_OBJECT_MISSING');
    const text = await extractResumeDocumentText(new Uint8Array(await object.arrayBuffer()), document.content_type);
    if (!text) throw new Error('RESUME_TEXT_EMPTY');
    const now = new Date().toISOString();
    const statements = buildResumeFactCandidates(text).map((candidate) => env.DB.prepare(`INSERT INTO remoteradar_resume_fact_drafts (id,user_id,resume_id,document_id,kind,label,value,confidence,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'pending',?9,?9) ON CONFLICT(document_id,kind,label) DO UPDATE SET value=excluded.value,confidence=excluded.confidence,status='pending',confirmed_fact_id=NULL,updated_at=excluded.updated_at`).bind(crypto.randomUUID(), document.user_id, document.resume_id, document.id, candidate.kind, candidate.label, candidate.value, candidate.confidence, now));
    await env.DB.batch([...statements, env.DB.prepare("UPDATE remoteradar_resume_documents SET extraction_status='ready', extracted_text=?2, extraction_error=NULL, updated_at=?3 WHERE id=?1").bind(document.id, text, now)]);
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : 'RESUME_EXTRACTION_FAILED';
    await env.DB.prepare("UPDATE remoteradar_resume_documents SET extraction_status='failed', extraction_error=?2, updated_at=?3 WHERE id=?1").bind(document.id, code, new Date().toISOString()).run();
  }
}

export async function processPendingRemoteRadarResumeDocuments(env: Env, limit = 2): Promise<{ processed: number }> {
  const rows = await env.DB.prepare("SELECT id,user_id,resume_id,object_key,content_type FROM remoteradar_resume_documents WHERE extraction_status IN ('pending','failed') AND extraction_attempts < 3 ORDER BY updated_at ASC LIMIT ?1").bind(Math.max(1, Math.min(limit, 5))).all<DocumentRow>();
  for (const document of rows.results) await processDocument(env, document);
  return { processed: rows.results.length };
}

async function ownedResume(env: Env, resumeId: string, userId: string): Promise<boolean> {
  return Boolean(await env.DB.prepare('SELECT id FROM native_rr_resumes WHERE id=?1 AND user_id=?2').bind(resumeId, userId).first());
}

async function createVersion(env: Env, userId: string, resumeId: string, documentId: string): Promise<Record<string, unknown>> {
  const facts = await env.DB.prepare('SELECT kind,label,value,confirmed_at FROM native_rr_resume_facts WHERE user_id=?1 AND resume_id=?2 ORDER BY kind,label').bind(userId, resumeId).all<Record<string, unknown>>();
  const versionRow = await env.DB.prepare('SELECT COALESCE(MAX(version),0)+1 AS version FROM remoteradar_resume_versions WHERE resume_id=?1').bind(resumeId).first<{ version: number }>();
  const version = versionRow?.version ?? 1; const id = crypto.randomUUID(); const createdAt = new Date().toISOString();
  await env.DB.prepare('INSERT INTO remoteradar_resume_versions (id,user_id,resume_id,version,snapshot_json,source_document_id,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)').bind(id, userId, resumeId, version, JSON.stringify({ facts: facts.results }), documentId, createdAt).run();
  return { id, resumeId, version, facts: facts.results, sourceDocumentId: documentId, createdAt };
}

export async function tryNativeRemoteRadarResumeDocuments(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url); if (!url.pathname.startsWith(`${base}/`)) return null;
  const user = await authenticateNativeUser(request, env); if (!user) return fail('UNAUTHORIZED', 'Login required', 401);
  const listMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/documents$/);
  if (listMatch && request.method === 'GET') {
    const resumeId = decodeURIComponent(listMatch[1]!); if (!await ownedResume(env, resumeId, user.id)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const rows = await env.DB.prepare('SELECT * FROM remoteradar_resume_documents WHERE resume_id=?1 AND user_id=?2 ORDER BY created_at DESC').bind(resumeId, user.id).all<Record<string, unknown>>(); return Response.json({ success: true, data: rows.results.map(item) }, { headers: { 'cache-control': 'no-store' } });
  }
  if (listMatch && request.method === 'POST') {
    const resumeId = decodeURIComponent(listMatch[1]!); if (!await ownedResume(env, resumeId, user.id)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const form = await request.formData().catch(() => null); const file = form?.get('file'); if (!(file instanceof File)) return fail('FILE_REQUIRED', 'Upload a resume file');
    if (!allowed.has(file.type)) return fail('UNSUPPORTED_FILE_TYPE', 'Only PDF, DOCX, and TXT resumes are supported'); if (file.size <= 0 || file.size > 8 * 1024 * 1024) return fail('FILE_TOO_LARGE', 'Resume files must be between 1 byte and 8 MB');
    const id = crypto.randomUUID(); const key = `private/resumes/${user.id}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; const now = new Date().toISOString();
    await env.ASSETS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    await env.DB.prepare(`INSERT INTO remoteradar_resume_documents (id,user_id,resume_id,object_key,filename,content_type,byte_size,extraction_status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8,?8)`).bind(id, user.id, resumeId, key, file.name.slice(0, 240), file.type, file.size, now).run();
    return Response.json({ success: true, data: item({ id, resume_id: resumeId, filename: file.name.slice(0, 240), content_type: file.type, byte_size: file.size, extraction_status: 'pending', created_at: now, updated_at: now }) }, { status: 201, headers: { 'cache-control': 'no-store' } });
  }
  const extractionMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/documents\/([^/]+)\/extraction$/);
  if (extractionMatch) {
    const resumeId = decodeURIComponent(extractionMatch[1]!); const documentId = decodeURIComponent(extractionMatch[2]!);
    if (!await ownedResume(env, resumeId, user.id)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const document = await env.DB.prepare('SELECT * FROM remoteradar_resume_documents WHERE id=?1 AND resume_id=?2 AND user_id=?3').bind(documentId, resumeId, user.id).first<Record<string, unknown>>();
    if (!document) return fail('DOCUMENT_NOT_FOUND', 'Resume document was not found', 404);
    if (request.method === 'POST') await processDocument(env, document as unknown as DocumentRow);
    if (request.method === 'GET' || request.method === 'POST') {
      const current = await env.DB.prepare('SELECT extraction_status,extracted_text,extraction_error,updated_at FROM remoteradar_resume_documents WHERE id=?1').bind(documentId).first<Record<string, unknown>>();
      const drafts = await env.DB.prepare('SELECT id,kind,label,value,confidence,status,confirmed_fact_id,created_at,updated_at FROM remoteradar_resume_fact_drafts WHERE document_id=?1 AND user_id=?2 ORDER BY kind,label').bind(documentId, user.id).all<Record<string, unknown>>();
      return Response.json({ success: true, data: { documentId, ...current, drafts: drafts.results } }, { headers: { 'cache-control': 'no-store' } });
    }
  }
  const draftMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/fact-drafts\/([^/]+)\/(confirm|reject)$/);
  if (draftMatch && request.method === 'POST') {
    const resumeId = decodeURIComponent(draftMatch[1]!); const draftId = decodeURIComponent(draftMatch[2]!); const action = draftMatch[3]!;
    if (!await ownedResume(env, resumeId, user.id)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const draft = await env.DB.prepare('SELECT * FROM remoteradar_resume_fact_drafts WHERE id=?1 AND resume_id=?2 AND user_id=?3').bind(draftId, resumeId, user.id).first<Record<string, unknown>>();
    if (!draft) return fail('FACT_DRAFT_NOT_FOUND', 'Resume fact draft was not found', 404);
    const now = new Date().toISOString();
    if (action === 'reject') {
      await env.DB.prepare("UPDATE remoteradar_resume_fact_drafts SET status='rejected',confirmed_fact_id=NULL,updated_at=?2 WHERE id=?1").bind(draftId, now).run();
      return Response.json({ success: true, data: { id: draftId, status: 'rejected' } }, { headers: { 'cache-control': 'no-store' } });
    }
    const factId = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO native_rr_resume_facts (id,user_id,resume_id,kind,label,value,confirmed_at,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7,?7) ON CONFLICT(user_id,resume_id,kind,label) DO UPDATE SET value=excluded.value,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at`).bind(factId, user.id, resumeId, draft.kind, draft.label, draft.value, now).run();
    const fact = await env.DB.prepare('SELECT id FROM native_rr_resume_facts WHERE user_id=?1 AND resume_id=?2 AND kind=?3 AND label=?4').bind(user.id, resumeId, draft.kind, draft.label).first<{ id: string }>();
    await env.DB.prepare("UPDATE remoteradar_resume_fact_drafts SET status='confirmed',confirmed_fact_id=?2,updated_at=?3 WHERE id=?1").bind(draftId, fact?.id ?? factId, now).run();
    const version = await createVersion(env, user.id, resumeId, String(draft.document_id));
    return Response.json({ success: true, data: { id: draftId, status: 'confirmed', factId: fact?.id ?? factId, version } }, { headers: { 'cache-control': 'no-store' } });
  }
  const versionsMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/versions$/);
  if (versionsMatch && request.method === 'GET') {
    const resumeId = decodeURIComponent(versionsMatch[1]!); if (!await ownedResume(env, resumeId, user.id)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const rows = await env.DB.prepare('SELECT id,version,snapshot_json,source_document_id,created_at FROM remoteradar_resume_versions WHERE resume_id=?1 AND user_id=?2 ORDER BY version DESC').bind(resumeId, user.id).all<Record<string, unknown>>();
    return Response.json({ success: true, data: rows.results.map((row) => ({ id: row.id, version: row.version, snapshot: JSON.parse(String(row.snapshot_json)), sourceDocumentId: row.source_document_id, createdAt: row.created_at })) }, { headers: { 'cache-control': 'no-store' } });
  }
  return fail('NOT_FOUND', 'Resume document route was not found', 404);
}

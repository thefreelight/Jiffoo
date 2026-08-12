import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { buildResumeFactCandidates, extractResumeDocumentText } from './resume-extraction';

type Env = NativeAuthEnv & Pick<Cloudflare.Env, 'DB' | 'ASSETS'>;
const base = '/api/v1/plugins/remoteradar-applications/store/resumes';
const allowed = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']);
function fail(code: string, message: string, status = 400) { return Response.json({ success: false, error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } }); }
function item(row: Record<string, unknown>) { return { id: row.id, resumeId: row.resume_id, filename: row.filename, contentType: row.content_type, byteSize: row.byte_size, extractionStatus: row.extraction_status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function fact(row: Record<string, unknown>) { return { id: row.id, resumeId: row.resume_id, kind: row.kind, label: row.label, value: row.value, active: row.is_active !== 0, confirmedAt: row.confirmed_at, createdAt: row.created_at, updatedAt: row.updated_at }; }
function value(input: unknown, max: number): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

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

async function createVersion(env: Env, userId: string, resumeId: string, documentId: string | null): Promise<Record<string, unknown>> {
  const facts = await env.DB.prepare('SELECT id,resume_id,kind,label,value,is_active,confirmed_at,created_at,updated_at FROM native_rr_resume_facts WHERE user_id=?1 AND resume_id=?2 ORDER BY kind,label').bind(userId, resumeId).all<Record<string, unknown>>();
  const versionRow = await env.DB.prepare('SELECT COALESCE(MAX(version),0)+1 AS version FROM remoteradar_resume_versions WHERE resume_id=?1').bind(resumeId).first<{ version: number }>();
  const version = versionRow?.version ?? 1; const id = crypto.randomUUID(); const createdAt = new Date().toISOString();
  await env.DB.prepare('INSERT INTO remoteradar_resume_versions (id,user_id,resume_id,version,snapshot_json,source_document_id,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)').bind(id, userId, resumeId, version, JSON.stringify({ facts: facts.results }), documentId, createdAt).run();
  return { id, resumeId, version, facts: facts.results.map(fact), createdAt };
}

async function ownedFact(env: Env, factId: string, resumeId: string, userId: string): Promise<Record<string, unknown> | null> {
  return env.DB.prepare('SELECT * FROM native_rr_resume_facts WHERE id=?1 AND resume_id=?2 AND user_id=?3').bind(factId, resumeId, userId).first<Record<string, unknown>>();
}

async function listFacts(env: Env, resumeId: string, userId: string): Promise<Response> {
  if (!await ownedResume(env, resumeId, userId)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
  const rows = await env.DB.prepare('SELECT id,resume_id,kind,label,value,is_active,confirmed_at,created_at,updated_at FROM native_rr_resume_facts WHERE resume_id=?1 AND user_id=?2 ORDER BY created_at ASC').bind(resumeId, userId).all<Record<string, unknown>>();
  return Response.json({ success: true, data: rows.results.map(fact) }, { headers: { 'cache-control': 'no-store' } });
}

async function deleteResume(env: Env, resumeId: string, userId: string): Promise<Response> {
  if (!await ownedResume(env, resumeId, userId)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
  const documents = await env.DB.prepare('SELECT object_key FROM remoteradar_resume_documents WHERE resume_id=?1 AND user_id=?2').bind(resumeId, userId).all<{ object_key: string }>();
  const objectKeys = documents.results.map((document) => document.object_key);
  if (objectKeys.length) {
    try {
      await env.ASSETS.delete(objectKeys);
    } catch {
      return fail('RESUME_STORAGE_DELETE_FAILED', 'Resume files could not be deleted', 503);
    }
  }
  const deleted = await env.DB.prepare('DELETE FROM native_rr_resumes WHERE id=?1 AND user_id=?2').bind(resumeId, userId).run();
  if (!deleted.meta.changes) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
  return Response.json({ success: true, data: { id: resumeId, deleted: true } }, { headers: { 'cache-control': 'no-store' } });
}

async function editFact(request: Request, env: Env, resumeId: string, factId: string, userId: string): Promise<Response> {
  const current = await ownedFact(env, factId, resumeId, userId);
  if (!current) return fail('RESUME_FACT_NOT_FOUND', 'Resume fact was not found', 404);
  const input: Record<string, unknown> = await request.json<Record<string, unknown>>().catch(() => ({}));
  const kind = input.kind === undefined ? String(current.kind) : value(input.kind, 80);
  const label = input.label === undefined ? String(current.label) : value(input.label, 240);
  const factValue = input.value === undefined ? String(current.value) : value(input.value, 4000);
  if (!kind || !label || !factValue || (input.kind === undefined && input.label === undefined && input.value === undefined)) {
    return fail('VALIDATION_ERROR', 'kind, label, or value is required');
  }
  const now = new Date().toISOString();
  try {
    await env.DB.prepare('UPDATE native_rr_resume_facts SET kind=?1,label=?2,value=?3,updated_at=?4 WHERE id=?5 AND resume_id=?6 AND user_id=?7').bind(kind, label, factValue, now, factId, resumeId, userId).run();
  } catch {
    return fail('RESUME_FACT_CONFLICT', 'A fact with this kind and label already exists', 409);
  }
  const version = await createVersion(env, userId, resumeId, null);
  return Response.json({ success: true, data: { fact: fact({ ...current, kind, label, value: factValue, updated_at: now }), version } }, { headers: { 'cache-control': 'no-store' } });
}

async function setFactActive(env: Env, resumeId: string, factId: string, userId: string, active: boolean): Promise<Response> {
  const current = await ownedFact(env, factId, resumeId, userId);
  if (!current) return fail('RESUME_FACT_NOT_FOUND', 'Resume fact was not found', 404);
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE native_rr_resume_facts SET is_active=?1,updated_at=?2 WHERE id=?3 AND resume_id=?4 AND user_id=?5').bind(active ? 1 : 0, now, factId, resumeId, userId).run();
  const version = await createVersion(env, userId, resumeId, null);
  return Response.json({ success: true, data: { fact: fact({ ...current, is_active: active ? 1 : 0, updated_at: now }), version } }, { headers: { 'cache-control': 'no-store' } });
}

async function deleteFact(env: Env, resumeId: string, factId: string, userId: string): Promise<Response> {
  if (!await ownedFact(env, factId, resumeId, userId)) return fail('RESUME_FACT_NOT_FOUND', 'Resume fact was not found', 404);
  const deleted = await env.DB.prepare('DELETE FROM native_rr_resume_facts WHERE id=?1 AND resume_id=?2 AND user_id=?3').bind(factId, resumeId, userId).run();
  if (!deleted.meta.changes) return fail('RESUME_FACT_NOT_FOUND', 'Resume fact was not found', 404);
  const version = await createVersion(env, userId, resumeId, null);
  return Response.json({ success: true, data: { id: factId, deleted: true, version } }, { headers: { 'cache-control': 'no-store' } });
}

export async function tryNativeRemoteRadarResumeDocuments(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url); if (!url.pathname.startsWith(`${base}/`)) return null;
  const user = await authenticateNativeUser(request, env); if (!user) return fail('UNAUTHORIZED', 'Login required', 401);
  const resumeMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)$/);
  if (resumeMatch && request.method === 'DELETE') return deleteResume(env, decodeURIComponent(resumeMatch[1]!), user.id);
  const factsMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/facts$/);
  if (factsMatch && request.method === 'GET') return listFacts(env, decodeURIComponent(factsMatch[1]!), user.id);
  const factMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/facts\/([^/]+)$/);
  if (factMatch && request.method === 'PATCH') return editFact(request, env, decodeURIComponent(factMatch[1]!), decodeURIComponent(factMatch[2]!), user.id);
  if (factMatch && request.method === 'DELETE') return deleteFact(env, decodeURIComponent(factMatch[1]!), decodeURIComponent(factMatch[2]!), user.id);
  const factStateMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/facts\/([^/]+)\/(disable|enable)$/);
  if (factStateMatch && request.method === 'POST') return setFactActive(env, decodeURIComponent(factStateMatch[1]!), decodeURIComponent(factStateMatch[2]!), user.id, factStateMatch[3] === 'enable');
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
    await env.DB.prepare(`INSERT INTO native_rr_resume_facts (id,user_id,resume_id,kind,label,value,is_active,confirmed_at,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,1,?7,?7,?7) ON CONFLICT(user_id,resume_id,kind,label) DO UPDATE SET value=excluded.value,is_active=1,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at`).bind(factId, user.id, resumeId, draft.kind, draft.label, draft.value, now).run();
    const fact = await env.DB.prepare('SELECT id FROM native_rr_resume_facts WHERE user_id=?1 AND resume_id=?2 AND kind=?3 AND label=?4').bind(user.id, resumeId, draft.kind, draft.label).first<{ id: string }>();
    await env.DB.prepare("UPDATE remoteradar_resume_fact_drafts SET status='confirmed',confirmed_fact_id=?2,updated_at=?3 WHERE id=?1").bind(draftId, fact?.id ?? factId, now).run();
    const version = await createVersion(env, user.id, resumeId, String(draft.document_id));
    return Response.json({ success: true, data: { id: draftId, status: 'confirmed', factId: fact?.id ?? factId, version } }, { headers: { 'cache-control': 'no-store' } });
  }
  const versionsMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/([^/]+)\/versions$/);
  if (versionsMatch && request.method === 'GET') {
    const resumeId = decodeURIComponent(versionsMatch[1]!); if (!await ownedResume(env, resumeId, user.id)) return fail('RESUME_NOT_FOUND', 'Resume was not found', 404);
    const rows = await env.DB.prepare('SELECT id,version,snapshot_json,source_document_id,created_at FROM remoteradar_resume_versions WHERE resume_id=?1 AND user_id=?2 ORDER BY version DESC').bind(resumeId, user.id).all<Record<string, unknown>>();
    return Response.json({ success: true, data: rows.results.map((row) => ({ id: row.id, version: row.version, snapshot: JSON.parse(String(row.snapshot_json)), createdAt: row.created_at })) }, { headers: { 'cache-control': 'no-store' } });
  }
  const legacyConfirmMatch = url.pathname.match(/^\/api\/v1\/plugins\/remoteradar-applications\/store\/resumes\/[^/]+\/facts\/confirm$/);
  if (legacyConfirmMatch && request.method === 'POST') return null;
  return fail('NOT_FOUND', 'Resume document route was not found', 404);
}

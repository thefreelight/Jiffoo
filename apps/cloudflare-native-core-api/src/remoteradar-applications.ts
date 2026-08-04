import { authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';

interface RemoteRadarApplicationsEnv extends NativeAuthEnv { DB: D1Database }

const STATUSES = new Set(['saved', 'planned', 'applied', 'screening', 'interview', 'offer', 'rejected', 'archived']);

function response(data: unknown, status = 200): Response {
  return Response.json({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-remoteradar-applications' },
  });
}
function fail(status: number, code: string, message: string): Response { return response({ code, message }, status); }
function text(value: unknown, max: number, fallback = ''): string | null {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : result.length === 0 && fallback !== undefined ? fallback : null;
}
function jsonObject(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try { return JSON.stringify(value); } catch { return null; }
}
function iso(value?: string | null): string { return value ?? new Date().toISOString(); }
function resume(row: Record<string, unknown>, facts: Array<Record<string, unknown>> = []): Record<string, unknown> {
  return { id: row.id, name: row.name, summary: row.summary, facts, createdAt: row.created_at, updatedAt: row.updated_at };
}
function fact(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, resumeId: row.resume_id, kind: row.kind, label: row.label, value: row.value, confirmedAt: row.confirmed_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
function savedJob(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, jobKey: row.job_key, title: row.title, company: row.company, location: row.location, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at };
}
function version(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, packId: row.pack_id, version: row.version, resumeSnapshot: JSON.parse(String(row.resume_snapshot)), coverLetter: row.cover_letter, answers: JSON.parse(String(row.answers)), approvedAt: row.approved_at, createdAt: row.created_at };
}
function pack(row: Record<string, unknown>, versions: Array<Record<string, unknown>> = []): Record<string, unknown> {
  return { id: row.id, savedJobId: row.saved_job_id, resumeId: row.resume_id, approvedVersionId: row.approved_version_id, versions, createdAt: row.created_at, updatedAt: row.updated_at };
}
function application(row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, savedJobId: row.saved_job_id, packId: row.pack_id, packVersionId: row.pack_version_id, status: row.status, appliedAt: row.applied_at, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at };
}
async function user(request: Request, env: RemoteRadarApplicationsEnv): Promise<NativeSessionUser | null> { return authenticateNativeUser(request, env); }
async function body(request: Request): Promise<Record<string, unknown>> { return request.json<Record<string, unknown>>().catch(() => ({})); }
function rejectProvenance(input: Record<string, unknown>): boolean { return Object.prototype.hasOwnProperty.call(input, 'sourceUrl') || Object.prototype.hasOwnProperty.call(input, 'provenance') || Object.prototype.hasOwnProperty.call(input, 'canonicalUrl') || Object.prototype.hasOwnProperty.call(input, 'source'); }

async function listResumes(env: RemoteRadarApplicationsEnv, userId: string): Promise<Response> {
  const rows = await env.DB.prepare('SELECT * FROM native_rr_resumes WHERE user_id = ?1 ORDER BY updated_at DESC').bind(userId).all<Record<string, unknown>>();
  const facts = await env.DB.prepare('SELECT * FROM native_rr_resume_facts WHERE user_id = ?1 ORDER BY created_at ASC').bind(userId).all<Record<string, unknown>>();
  return response(rows.results.map((row) => resume(row, facts.results.filter((item) => item.resume_id === row.id).map(fact))));
}
async function createResume(request: Request, env: RemoteRadarApplicationsEnv, userId: string): Promise<Response> {
  const input = await body(request); const name = text(input.name, 120); const summary = text(input.summary, 4000, '');
  if (!name || summary === null) return fail(400, 'VALIDATION_ERROR', 'name and summary are required');
  const now = new Date().toISOString(); const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO native_rr_resumes (id, user_id, name, summary, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)').bind(id, userId, name, summary, now).run();
  return response({ id, name, summary, facts: [], createdAt: now, updatedAt: now }, 201);
}
async function confirmFact(request: Request, env: RemoteRadarApplicationsEnv, userId: string, resumeId: string): Promise<Response> {
  const input = await body(request); const kind = text(input.kind, 80); const label = text(input.label, 240); const value = text(input.value, 4000);
  if (!kind || !label || !value) return fail(400, 'VALIDATION_ERROR', 'kind, label, and value are required');
  const owned = await env.DB.prepare('SELECT id FROM native_rr_resumes WHERE id = ?1 AND user_id = ?2').bind(resumeId, userId).first();
  if (!owned) return fail(404, 'RESUME_NOT_FOUND', 'Resume was not found');
  const now = new Date().toISOString(); const existing = await env.DB.prepare('SELECT id, created_at FROM native_rr_resume_facts WHERE user_id = ?1 AND resume_id = ?2 AND kind = ?3 AND label = ?4').bind(userId, resumeId, kind, label).first<{ id: string; created_at: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO native_rr_resume_facts (id, user_id, resume_id, kind, label, value, confirmed_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?7) ON CONFLICT(user_id, resume_id, kind, label) DO UPDATE SET value = excluded.value, confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at`).bind(id, userId, resumeId, kind, label, value, now, existing?.created_at ?? now).run();
  return response(fact({ id, resume_id: resumeId, kind, label, value, confirmed_at: now, created_at: existing?.created_at ?? now, updated_at: now }));
}
async function listSavedJobs(env: RemoteRadarApplicationsEnv, userId: string): Promise<Response> { const rows = await env.DB.prepare('SELECT * FROM native_rr_saved_jobs WHERE user_id = ?1 ORDER BY updated_at DESC').bind(userId).all<Record<string, unknown>>(); return response(rows.results.map(savedJob)); }
async function saveJob(request: Request, env: RemoteRadarApplicationsEnv, userId: string): Promise<Response> {
  const input = await body(request); if (rejectProvenance(input)) return fail(400, 'PROVENANCE_FORBIDDEN', 'Source and provenance fields are not accepted in user requests');
  const jobKey = text(input.jobKey, 160); const title = text(input.title, 240); const company = text(input.company, 240); const location = text(input.location, 240, ''); const description = text(input.description, 20000, '');
  if (!jobKey || !title || !company || location === null || description === null) return fail(400, 'VALIDATION_ERROR', 'jobKey, title, company, location, and description are invalid');
  const now = new Date().toISOString(); const existing = await env.DB.prepare('SELECT id, created_at FROM native_rr_saved_jobs WHERE user_id = ?1 AND job_key = ?2').bind(userId, jobKey).first<{ id: string; created_at: string }>(); const id = existing?.id ?? crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO native_rr_saved_jobs (id, user_id, job_key, title, company, location, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) ON CONFLICT(user_id, job_key) DO UPDATE SET title = excluded.title, company = excluded.company, location = excluded.location, description = excluded.description, updated_at = excluded.updated_at`).bind(id, userId, jobKey, title, company, location || null, description, existing?.created_at ?? now).run();
  return response(savedJob({ id, job_key: jobKey, title, company, location: location || null, description, created_at: existing?.created_at ?? now, updated_at: now }), existing ? 200 : 201);
}
async function createPack(request: Request, env: RemoteRadarApplicationsEnv, userId: string): Promise<Response> {
  const input = await body(request); const savedJobId = text(input.savedJobId, 80); const resumeId = text(input.resumeId, 80); const resumeSnapshot = jsonObject(input.resumeSnapshot); const coverLetter = text(input.coverLetter, 20000, ''); const answers = jsonObject(input.answers ?? {});
  if (!savedJobId || !resumeId || !resumeSnapshot || coverLetter === null || !answers) return fail(400, 'VALIDATION_ERROR', 'savedJobId, resumeId, resumeSnapshot, coverLetter, and answers are required');
  const [job, resumeRow] = await Promise.all([env.DB.prepare('SELECT id FROM native_rr_saved_jobs WHERE id = ?1 AND user_id = ?2').bind(savedJobId, userId).first(), env.DB.prepare('SELECT id FROM native_rr_resumes WHERE id = ?1 AND user_id = ?2').bind(resumeId, userId).first()]);
  if (!job || !resumeRow) return fail(404, 'PACK_INPUT_NOT_FOUND', 'Saved job or resume was not found');
  const packId = crypto.randomUUID(); const versionId = crypto.randomUUID(); const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO native_rr_application_packs (id, user_id, saved_job_id, resume_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)').bind(packId, userId, savedJobId, resumeId, now),
    env.DB.prepare('INSERT INTO native_rr_application_pack_versions (id, user_id, pack_id, version, resume_snapshot, cover_letter, answers, created_at) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7)').bind(versionId, userId, packId, resumeSnapshot, coverLetter, answers, now),
  ]);
  return response(pack({ id: packId, saved_job_id: savedJobId, resume_id: resumeId, approved_version_id: null, created_at: now, updated_at: now }, [version({ id: versionId, pack_id: packId, version: 1, resume_snapshot: resumeSnapshot, cover_letter: coverLetter, answers, approved_at: null, created_at: now })]), 201);
}
async function listPacks(env: RemoteRadarApplicationsEnv, userId: string): Promise<Response> { const rows = await env.DB.prepare('SELECT * FROM native_rr_application_packs WHERE user_id = ?1 ORDER BY updated_at DESC').bind(userId).all<Record<string, unknown>>(); const versions = await env.DB.prepare('SELECT * FROM native_rr_application_pack_versions WHERE user_id = ?1 ORDER BY version ASC').bind(userId).all<Record<string, unknown>>(); return response(rows.results.map((row) => pack(row, versions.results.filter((item) => item.pack_id === row.id).map(version)))); }
async function createPackVersion(request: Request, env: RemoteRadarApplicationsEnv, userId: string, packId: string): Promise<Response> {
  const input = await body(request); const resumeSnapshot = jsonObject(input.resumeSnapshot); const coverLetter = text(input.coverLetter, 20000); const answers = jsonObject(input.answers ?? {}); if (!resumeSnapshot || coverLetter === null || !answers) return fail(400, 'VALIDATION_ERROR', 'resumeSnapshot, coverLetter, and answers are required');
  const packRow = await env.DB.prepare('SELECT id FROM native_rr_application_packs WHERE id = ?1 AND user_id = ?2').bind(packId, userId).first(); if (!packRow) return fail(404, 'PACK_NOT_FOUND', 'Application pack was not found');
  const latest = await env.DB.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM native_rr_application_pack_versions WHERE pack_id = ?1 AND user_id = ?2').bind(packId, userId).first<{ version: number }>(); const next = Number(latest?.version ?? 0) + 1; const id = crypto.randomUUID(); const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO native_rr_application_pack_versions (id, user_id, pack_id, version, resume_snapshot, cover_letter, answers, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(id, userId, packId, next, resumeSnapshot, coverLetter, answers, now),
    env.DB.prepare('UPDATE native_rr_application_packs SET updated_at = ?1 WHERE id = ?2 AND user_id = ?3').bind(now, packId, userId),
  ]);
  return response(version({ id, pack_id: packId, version: next, resume_snapshot: resumeSnapshot, cover_letter: coverLetter, answers, approved_at: null, created_at: now }), 201);
}
async function approveVersion(env: RemoteRadarApplicationsEnv, userId: string, packId: string, versionId: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT id, pack_id, version FROM native_rr_application_pack_versions WHERE id = ?1 AND pack_id = ?2 AND user_id = ?3').bind(versionId, packId, userId).first<{ id: string; pack_id: string; version: number }>(); if (!row) return fail(404, 'PACK_VERSION_NOT_FOUND', 'Application pack version was not found'); const now = new Date().toISOString();
  await env.DB.batch([env.DB.prepare('UPDATE native_rr_application_pack_versions SET approved_at = COALESCE(approved_at, ?1) WHERE id = ?2 AND user_id = ?3').bind(now, versionId, userId), env.DB.prepare('UPDATE native_rr_application_packs SET approved_version_id = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4').bind(versionId, now, packId, userId)]);
  return response({ packId, approvedVersionId: versionId, approvedAt: now });
}
async function listApplications(env: RemoteRadarApplicationsEnv, userId: string): Promise<Response> { const rows = await env.DB.prepare('SELECT * FROM native_rr_job_applications WHERE user_id = ?1 ORDER BY updated_at DESC').bind(userId).all<Record<string, unknown>>(); return response(rows.results.map(application)); }
async function trackApplication(request: Request, env: RemoteRadarApplicationsEnv, userId: string, savedJobId: string): Promise<Response> {
  const input = await body(request); const packId = text(input.packId, 80); const status = typeof input.status === 'string' && STATUSES.has(input.status) ? input.status : 'planned'; const appliedAt = input.appliedAt === undefined ? null : typeof input.appliedAt === 'string' ? input.appliedAt : null; const note = input.note === undefined ? null : text(input.note, 2000, ''); if (!packId || (input.appliedAt !== undefined && !appliedAt) || note === null && input.note !== undefined) return fail(400, 'VALIDATION_ERROR', 'packId and valid application fields are required');
  const packRow = await env.DB.prepare('SELECT id, approved_version_id FROM native_rr_application_packs WHERE id = ?1 AND saved_job_id = ?2 AND user_id = ?3').bind(packId, savedJobId, userId).first<{ id: string; approved_version_id: string | null }>(); if (!packRow) return fail(404, 'PACK_NOT_FOUND', 'Application pack was not found'); if (!packRow.approved_version_id) return fail(409, 'PACK_APPROVAL_REQUIRED', 'Approve an application pack version before tracking an application');
  const id = crypto.randomUUID(); const now = new Date().toISOString(); await env.DB.prepare('INSERT INTO native_rr_job_applications (id, user_id, saved_job_id, pack_id, pack_version_id, status, applied_at, note, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)').bind(id, userId, savedJobId, packId, packRow.approved_version_id, status, appliedAt, note, now).run(); return response(application({ id, saved_job_id: savedJobId, pack_id: packId, pack_version_id: packRow.approved_version_id, status, applied_at: appliedAt, note, created_at: now, updated_at: now }), 201);
}
async function updateApplication(request: Request, env: RemoteRadarApplicationsEnv, userId: string, applicationId: string): Promise<Response> {
  const input = await body(request); const existing = await env.DB.prepare('SELECT * FROM native_rr_job_applications WHERE id = ?1 AND user_id = ?2').bind(applicationId, userId).first<Record<string, unknown>>(); if (!existing) return fail(404, 'APPLICATION_NOT_FOUND', 'Application was not found'); const nextStatus = input.status === undefined ? existing.status : typeof input.status === 'string' && STATUSES.has(input.status) ? input.status : null; if (!nextStatus) return fail(400, 'VALIDATION_ERROR', 'status is invalid'); const nextApplied = input.appliedAt === undefined ? existing.applied_at : input.appliedAt === null ? null : typeof input.appliedAt === 'string' ? input.appliedAt : null; if (input.appliedAt !== undefined && input.appliedAt !== null && !nextApplied) return fail(400, 'VALIDATION_ERROR', 'appliedAt is invalid'); const nextNote = input.note === undefined ? existing.note : input.note === null ? null : text(input.note, 2000, ''); if (input.note !== undefined && input.note !== null && nextNote === null) return fail(400, 'VALIDATION_ERROR', 'note is invalid'); const now = new Date().toISOString(); await env.DB.prepare('UPDATE native_rr_job_applications SET status = ?1, applied_at = ?2, note = ?3, updated_at = ?4 WHERE id = ?5 AND user_id = ?6').bind(nextStatus, nextApplied, nextNote, now, applicationId, userId).run(); return response(application({ ...existing, status: nextStatus, applied_at: nextApplied, note: nextNote, updated_at: now }));
}

export async function tryNativeRemoteRadarApplications(request: Request, env: RemoteRadarApplicationsEnv): Promise<Response | null> {
  const url = new URL(request.url); const base = '/api/v1/plugins/remoteradar-applications/store'; if (!url.pathname.startsWith(`${base}/`)) return null;
  const current = await user(request, env); if (!current) return fail(401, 'UNAUTHORIZED', 'Login required'); const path = url.pathname.slice(base.length);
  if (request.method === 'GET' && path === '/resumes') return listResumes(env, current.id);
  if (request.method === 'POST' && path === '/resumes') return createResume(request, env, current.id);
  const factMatch = path.match(/^\/resumes\/([^/]+)\/facts\/confirm$/); if (factMatch && request.method === 'POST') return confirmFact(request, env, current.id, decodeURIComponent(factMatch[1]!));
  if (request.method === 'GET' && path === '/saved-jobs') return listSavedJobs(env, current.id);
  if (request.method === 'POST' && path === '/saved-jobs') return saveJob(request, env, current.id);
  if (request.method === 'GET' && path === '/application-packs') return listPacks(env, current.id);
  if (request.method === 'POST' && path === '/application-packs') return createPack(request, env, current.id);
  const versionMatch = path.match(/^\/application-packs\/([^/]+)\/versions$/); if (versionMatch && request.method === 'POST') return createPackVersion(request, env, current.id, decodeURIComponent(versionMatch[1]!));
  const approveMatch = path.match(/^\/application-packs\/([^/]+)\/versions\/([^/]+)\/approve$/); if (approveMatch && request.method === 'POST') return approveVersion(env, current.id, decodeURIComponent(approveMatch[1]!), decodeURIComponent(approveMatch[2]!));
  if (request.method === 'GET' && path === '/applications') return listApplications(env, current.id);
  const trackMatch = path.match(/^\/saved-jobs\/([^/]+)\/applications$/); if (trackMatch && request.method === 'POST') return trackApplication(request, env, current.id, decodeURIComponent(trackMatch[1]!));
  const appMatch = path.match(/^\/applications\/([^/]+)$/); if (appMatch && request.method === 'PATCH') return updateApplication(request, env, current.id, decodeURIComponent(appMatch[1]!));
  return fail(404, 'NOT_FOUND', 'RemoteRadar application route was not found');
}

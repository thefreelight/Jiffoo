import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const { buildResumeFactCandidates, extractResumeDocumentText } = await import('./resume-extraction');
const { tryNativeRemoteRadarResumeDocuments } = await import('./remoteradar-resumes');

const base = 'https://api.example/api/v1/plugins/remoteradar-applications/store/resumes';
type Row = Record<string, unknown>;

function routeEnv(options: { resume?: Row | null; fact?: Row | null; documents?: Row[]; facts?: Row[]; r2DeleteError?: boolean } = {}) {
  const statements: Array<{ sql: string; args: unknown[] }> = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => {
        if (sql.includes('native_rr_resumes WHERE id')) return options.resume ?? null;
        if (sql.includes('native_rr_resume_facts WHERE id')) return options.fact ?? null;
        if (sql.includes('COALESCE(MAX(version)')) return { version: 2 };
        return null;
      },
      all: async () => {
        if (sql.includes('SELECT object_key')) return { results: options.documents ?? [] };
        if (sql.includes('FROM native_rr_resume_facts')) return { results: options.facts ?? [] };
        return { results: [] };
      },
      run: async () => {
        statements.push({ sql, args });
        return { success: true, meta: { changes: 1 } };
      },
    }),
  }));
  const deleteObjects = vi.fn(async () => {
    if (options.r2DeleteError) throw new Error('R2 unavailable');
  });
  return { DB: { prepare }, ASSETS: { delete: deleteObjects }, statements, deleteObjects };
}

describe('RemoteRadar resume extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
  });
  it('normalizes TXT and extracts high-confidence contact facts', async () => {
    const text = await extractResumeDocumentText(
      strToU8('Alex Example\r\n alex@example.com\t +1 (415) 555-0134\r\nhttps://example.com/alex'),
      'text/plain',
    );
    expect(text).toContain('Alex Example\nalex@example.com +1 (415) 555-0134');
    const facts = buildResumeFactCandidates(text);
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'contact', label: 'email', value: 'alex@example.com', confidence: 0.99 }),
      expect.objectContaining({ kind: 'contact', label: 'phone', value: '+1 (415) 555-0134' }),
      expect.objectContaining({ kind: 'contact', label: 'link_1', value: 'https://example.com/alex' }),
    ]));
  });

  it('extracts paragraphs, tabs, breaks, and XML entities from DOCX', async () => {
    const docx = zipSync({
      'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>Senior &amp; Staff</w:t></w:r></w:p><w:p><w:r><w:t>TypeScript</w:t><w:tab/><w:t>Cloudflare</w:t><w:br/><w:t>Workers</w:t></w:r></w:p></w:body></w:document>'),
    });
    await expect(extractResumeDocumentText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .resolves.toBe('Senior & Staff\nTypeScript Cloudflare\nWorkers');
  });

  it('rejects malformed DOCX input', async () => {
    const docx = zipSync({ 'other.xml': strToU8('<xml/>') });
    await expect(extractResumeDocumentText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .rejects.toThrow('DOCX_DOCUMENT_XML_MISSING');
  });

  it('deletes only an owned resume after removing every private R2 document object', async () => {
    const state = routeEnv({ resume: { id: 'resume-1' }, documents: [{ object_key: 'private/resumes/user-1/doc-1/a.pdf' }, { object_key: 'private/resumes/user-1/doc-2/b.docx' }] });
    const response = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-1`, { method: 'DELETE' }), state as never);
    expect(response?.status).toBe(200);
    expect(state.deleteObjects).toHaveBeenCalledWith(['private/resumes/user-1/doc-1/a.pdf', 'private/resumes/user-1/doc-2/b.docx']);
    expect(state.statements).toEqual(expect.arrayContaining([expect.objectContaining({ sql: expect.stringContaining('DELETE FROM native_rr_resumes'), args: ['resume-1', 'user-1'] })]));
    expect(JSON.stringify(await response?.json())).not.toMatch(/object_key|private\/resumes|provenance/i);
  });

  it('does not expose or delete another user resume', async () => {
    const state = routeEnv({ resume: null, documents: [{ object_key: 'private/resumes/user-2/doc.pdf' }] });
    const response = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-2`, { method: 'DELETE' }), state as never);
    expect(response?.status).toBe(404);
    expect(state.deleteObjects).not.toHaveBeenCalled();
    expect(state.statements).toHaveLength(0);
  });

  it('keeps database relations when private object deletion fails', async () => {
    const state = routeEnv({ resume: { id: 'resume-1' }, documents: [{ object_key: 'private/resumes/user-1/doc.pdf' }], r2DeleteError: true });
    const response = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-1`, { method: 'DELETE' }), state as never);
    expect(response?.status).toBe(503);
    expect(state.statements).toHaveLength(0);
  });

  it('lists privacy-safe facts and hides internal version document references', async () => {
    const factRow = { id: 'fact-1', resume_id: 'resume-1', kind: 'skill', label: 'TypeScript', value: '6 years', is_active: 0, confirmed_at: 'confirmed', created_at: 'created', updated_at: 'updated' };
    const state = routeEnv({ resume: { id: 'resume-1' }, facts: [factRow] });
    const response = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-1/facts`), state as never);
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({ success: true, data: [{ id: 'fact-1', resumeId: 'resume-1', kind: 'skill', label: 'TypeScript', value: '6 years', active: false, confirmedAt: 'confirmed', createdAt: 'created', updatedAt: 'updated' }] });
  });

  it('edits an owned fact and records a new privacy-safe resume version', async () => {
    const current = { id: 'fact-1', user_id: 'user-1', resume_id: 'resume-1', kind: 'skill', label: 'TypeScript', value: '5 years', confirmed_at: 'confirmed', created_at: 'created', updated_at: 'updated' };
    const state = routeEnv({ fact: current, facts: [{ ...current, value: '6 years' }] });
    const response = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-1/facts/fact-1`, { method: 'PATCH', body: JSON.stringify({ value: '6 years' }) }), state as never);
    expect(response?.status).toBe(200);
    expect(state.statements[0]).toMatchObject({ sql: expect.stringContaining('WHERE id=?6 AND resume_id=?7 AND user_id=?8') });
    const payload = JSON.stringify(await response?.json());
    expect(payload).toContain('6 years');
    expect(payload).not.toMatch(/object_key|sourceDocumentId|provenance/i);
    const versionInsert = state.statements.find((statement) => statement.sql.includes('INSERT INTO remoteradar_resume_versions'));
    expect(JSON.parse(String(versionInsert?.args[4]))).toEqual({ facts: [{
      id: 'fact-1', resumeId: 'resume-1', kind: 'skill', label: 'TypeScript', value: '6 years', active: true,
      confirmedAt: 'confirmed', createdAt: 'created', updatedAt: 'updated',
    }] });
    expect(String(versionInsert?.args[4])).not.toMatch(/resume_id|is_active|confirmed_at|created_at|updated_at|user_id/);
  });

  it('disables, re-enables, and deletes only an owned fact', async () => {
    const current = { id: 'fact-1', user_id: 'user-1', resume_id: 'resume-1', kind: 'skill', label: 'TypeScript', value: '6 years', confirmed_at: 'confirmed', created_at: 'created', updated_at: 'updated' };
    const disabled = routeEnv({ fact: { ...current, is_active: 1 }, facts: [{ ...current, is_active: 0 }] });
    const disableResponse = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-1/facts/fact-1/disable`, { method: 'POST' }), disabled as never);
    expect(disableResponse?.status).toBe(200);
    expect(disabled.statements[0]).toMatchObject({ sql: expect.stringContaining('is_active=?1'), args: [0, expect.any(String), 'fact-1', 'resume-1', 'user-1'] });

    const enabled = routeEnv({ fact: { ...current, is_active: 0 }, facts: [{ ...current, is_active: 1 }] });
    const enableResponse = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-1/facts/fact-1/enable`, { method: 'POST' }), enabled as never);
    expect(enableResponse?.status).toBe(200);
    expect(enabled.statements[0]?.args[0]).toBe(1);

    const deleted = routeEnv({ fact: current, facts: [] });
    const deleteResponse = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-1/facts/fact-1`, { method: 'DELETE' }), deleted as never);
    expect(deleteResponse?.status).toBe(200);
    expect(deleted.statements[0]).toMatchObject({ sql: expect.stringContaining('DELETE FROM native_rr_resume_facts'), args: ['fact-1', 'resume-1', 'user-1'] });
  });

  it('returns not found for a fact outside the authenticated owner scope', async () => {
    const state = routeEnv({ fact: null });
    const response = await tryNativeRemoteRadarResumeDocuments(new Request(`${base}/resume-2/facts/fact-2`, { method: 'PATCH', body: JSON.stringify({ value: 'private' }) }), state as never);
    expect(response?.status).toBe(404);
    expect(state.statements).toHaveLength(0);
  });
});

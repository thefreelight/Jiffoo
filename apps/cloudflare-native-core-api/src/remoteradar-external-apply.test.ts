import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
const authenticateNativeAdmin = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser, authenticateNativeAdmin }));
const { tryNativeRemoteRadarExternalApply } = await import('./remoteradar-external-apply');

function env(rows: Record<string, unknown> = {}) {
  const statements: Array<{ sql: string; args: unknown[] }> = [];
  return {
    statements,
    DB: {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('FROM native_rr_job_applications')) return rows.application ?? null;
            if (sql.includes('FROM remoteradar_job_targets')) return rows.target ?? null;
            if (sql.includes('SELECT target_url FROM remoteradar_external_apply_grants')) return rows.grant ?? null;
            return null;
          },
          run: async () => {
            statements.push({ sql, args });
            return { meta: { changes: rows.claimChanges ?? 1 } };
          },
        }),
      }),
    },
  };
}

describe('RemoteRadar controlled external apply v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1' });
  });

  it('binds a new grant to the job and approved pack version without exposing the target URL', async () => {
    const state = env({
      application: { id: 'app-1', pack_version_id: 'version-1', approved_version_id: 'version-1', job_id: 'saved-job-1', job_key: 'job-key-1' },
      target: { target_url: 'https://ats.example/apply/secret' },
    });
    const response = await tryNativeRemoteRadarExternalApply(new Request('https://api.example/api/v1/plugins/remoteradar-applications/store/applications/app-1/external-apply-grants', { method: 'POST' }), state as never);
    expect(response?.status).toBe(201);
    const payload = await response?.json() as { data: Record<string, unknown> };
    expect(payload.data).toMatchObject({ singleUse: true, targetCategory: 'external_ats', reason: expect.any(String) });
    expect(JSON.stringify(payload)).not.toContain('ats.example');
    const insert = state.statements.find((statement) => statement.sql.includes('INSERT INTO remoteradar_external_apply_grants'));
    expect(insert?.args).toEqual(expect.arrayContaining(['user-1', 'app-1', 'saved-job-1', 'version-1', 'external_ats']));
  });

  it('checks a grant before atomically consuming it and rejects revoked grants', async () => {
    const missing = env({ grant: null });
    const response = await tryNativeRemoteRadarExternalApply(new Request('https://api.example/api/v1/remoteradar/external-apply/token'), missing as never);
    expect(response?.status).toBe(404);
    expect(missing.statements).toHaveLength(0);
  });

  it('requires the application current pack version to be the approved version', async () => {
    const state = env({ application: { id: 'app-1', pack_version_id: 'draft', approved_version_id: 'approved', job_id: 'job-1', job_key: 'key' } });
    const response = await tryNativeRemoteRadarExternalApply(new Request('https://api.example/api/v1/plugins/remoteradar-applications/store/applications/app-1/external-apply-grants', { method: 'POST' }), state as never);
    expect(response?.status).toBe(409);
    expect(state.statements).toHaveLength(0);
  });
});

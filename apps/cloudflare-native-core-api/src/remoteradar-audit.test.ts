import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
vi.mock('./auth', () => ({ authenticateNativeUser }));

const { recordRemoteRadarAuditEvent, tryNativeRemoteRadarAudit } = await import('./remoteradar-audit');

function database(rows: Array<Record<string, unknown>> = []) {
  const calls: Array<{ sql: string; args: unknown[] }> = [];
  return {
    calls,
    prepare(sql: string) {
      const call = { sql, args: [] as unknown[] }; calls.push(call);
      return {
        bind(...args: unknown[]) { call.args = args; return this; },
        run: async () => ({ success: true }),
        all: async () => ({ results: rows }),
      };
    },
  };
}

describe('RemoteRadar privacy-safe audit events', () => {
  beforeEach(() => authenticateNativeUser.mockReset());

  it('records only allow-listed metadata', async () => {
    const DB = database();
    await recordRemoteRadarAuditEvent({ DB } as never, {
      userId: 'user-1', eventType: 'application.sent', resourceType: 'application', resourceId: 'app-1',
      metadata: { submissionId: 'sub-1', transport: 'user_smtp', sourceUrl: 'https://competitor.example/job', resumeBody: 'secret' },
    });
    expect(JSON.parse(String(DB.calls[0]?.args[5]))).toEqual({ submissionId: 'sub-1', transport: 'user_smtp' });
  });

  it('requires authentication', async () => {
    authenticateNativeUser.mockResolvedValue(null);
    const result = await tryNativeRemoteRadarAudit(new Request('https://api.example/api/v1/plugins/remoteradar-applications/store/audit-events'), { DB: database() } as never);
    expect(result?.status).toBe(401);
  });

  it('scopes reads to the current user and redacts unsafe stored metadata', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const DB = database([{ id: 'event-1', event_type: 'application.sent', resource_type: 'application', resource_id: 'app-1', metadata: JSON.stringify({ submissionId: 'sub-1', sourceUrl: 'https://competitor.example' }), created_at: '2026-08-12T10:00:00.000Z' }]);
    const result = await tryNativeRemoteRadarAudit(new Request('https://api.example/api/v1/plugins/remoteradar-applications/store/audit-events?limit=10'), { DB } as never);
    expect(result?.status).toBe(200);
    expect(result?.headers.get('cache-control')).toBe('no-store');
    await expect(result?.json()).resolves.toMatchObject({ data: { items: [{ metadata: { submissionId: 'sub-1' } }], nextCursor: null } });
    expect(DB.calls[0]?.args).toEqual(['user-1', 11]);
  });

  it('uses a bounded compound cursor', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1' });
    const DB = database([]);
    await tryNativeRemoteRadarAudit(new Request('https://api.example/api/v1/plugins/remoteradar-applications/store/audit-events?limit=500&cursor=2026-08-12T10%3A00%3A00.000Z%7Cevent-9'), { DB } as never);
    expect(DB.calls[0]?.args).toEqual(['user-1', '2026-08-12T10:00:00.000Z', 'event-9', 101]);
  });
});

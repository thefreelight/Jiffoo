import { describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();

vi.mock('./auth', () => ({ authenticateNativeUser }));

const { tryNativeRemoteRadarApplications } = await import('./remoteradar-applications');

const baseUrl = 'https://api.example/api/v1/plugins/remoteradar-applications/store';

function database(first: unknown = null) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => first),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ success: true })),
      })),
    })),
    batch: vi.fn(async () => []),
  };
}

describe('native RemoteRadar applications adapter', () => {
  it('requires a signed-in user before exposing application workspace data', async () => {
    authenticateNativeUser.mockResolvedValueOnce(null);
    const response = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/resumes`), { DB: database() } as never);
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects source and provenance fields from user-controlled saved jobs', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const db = database();
    const response = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/saved-jobs`, {
      method: 'POST',
      body: JSON.stringify({ jobKey: 'job-1', title: 'Engineer', company: 'Acme', sourceUrl: 'https://competitor.example/job-1' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'PROVENANCE_FORBIDDEN' } });
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('requires an approved pack version before an application can be recorded', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const response = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/saved-jobs/job-1/applications`, {
      method: 'POST',
      body: JSON.stringify({ packId: 'pack-1', status: 'planned' }),
    }), { DB: database({ id: 'pack-1', approved_version_id: null }) } as never);
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({ error: { code: 'PACK_APPROVAL_REQUIRED' } });
  });
});

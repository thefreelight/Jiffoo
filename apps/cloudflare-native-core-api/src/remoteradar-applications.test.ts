import { describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();

vi.mock('./auth', () => ({ authenticateNativeUser }));

const { tryNativeRemoteRadarApplications } = await import('./remoteradar-applications');

const baseUrl = 'https://api.example/api/v1/plugins/remoteradar-applications/store';

function database(first: unknown = null) {
  const bind = vi.fn(() => ({
    first: vi.fn(async () => first),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(async () => ({ success: true })),
  }));
  return {
    prepare: vi.fn(() => ({ bind })),
    batch: vi.fn(async () => []),
    bind,
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

  it('does not expose the internal job reference in saved-job responses', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const response = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/saved-jobs`, {
      method: 'POST',
      body: JSON.stringify({ jobKey: 'connector:job-1', title: 'Engineer', company: 'Acme', location: 'Remote', description: 'Build things' }),
    }), { DB: database() } as never);
    expect(response?.status).toBe(201);
    const payload = await response?.json() as { data: Record<string, unknown> };
    expect(payload.data).not.toHaveProperty('jobKey');
    expect(payload.data).toMatchObject({ title: 'Engineer', company: 'Acme' });
  });

  it('preserves createdAt while advancing updatedAt on saved-job updates', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const createdAt = '2026-01-01T00:00:00.000Z';
    const db = database({ id: 'saved-1', created_at: createdAt });
    const response = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/saved-jobs`, {
      method: 'POST',
      body: JSON.stringify({ jobKey: 'job-1', title: 'Engineer', company: 'Acme' }),
    }), { DB: db } as never);
    expect(response?.status).toBe(200);
    const writeArguments = db.bind.mock.calls.at(-1)!;
    expect(writeArguments[7]).toBe(createdAt);
    expect(writeArguments[8]).not.toBe(createdAt);
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

  it('rejects invalid lifecycle status and appliedAt values', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const invalidStatus = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/saved-jobs/job-1/applications`, {
      method: 'POST',
      body: JSON.stringify({ packId: 'pack-1', status: 'unknown' }),
    }), { DB: database() } as never);
    expect(invalidStatus?.status).toBe(400);

    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    const invalidDate = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/saved-jobs/job-1/applications`, {
      method: 'POST',
      body: JSON.stringify({ packId: 'pack-1', appliedAt: 'not-a-date' }),
    }), { DB: database() } as never);
    expect(invalidDate?.status).toBe(400);
  });
});

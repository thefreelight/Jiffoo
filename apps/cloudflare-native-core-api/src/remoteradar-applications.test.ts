import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeUser = vi.fn();
const nativeWalletFinish = vi.fn();
const nativeWalletMutate = vi.fn();
const nativeWalletReserve = vi.fn();
const remoteRadarAllowanceStatus = vi.fn();

vi.mock('./auth', () => ({ authenticateNativeUser }));
vi.mock('./native-wallet', () => ({ nativeWalletFinish, nativeWalletMutate, nativeWalletReserve }));
vi.mock('./remoteradar-entitlements', () => ({ remoteRadarAllowanceStatus }));

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

function meteredDatabase(options: { failArtifactWrite?: boolean; failReservationRecord?: boolean } = {}) {
  const charge: Record<string, unknown> = {
    id: 'charge-1', user_id: 'user-1', idempotency_key: 'generation-1', operation: 'create',
    target_pack_id: null, grant_id: null, wallet_reservation_id: null, attempt: 0, status: 'initiated',
    result_pack_id: null, result_version_id: null, updated_at: new Date().toISOString(),
  };
  let packRow: Record<string, unknown> | null = null;
  let versionRow: Record<string, unknown> | null = null;
  const prepare = vi.fn((sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => {
        if (sql.includes('native_rr_saved_jobs WHERE id')) return { id: 'job-1' };
        if (sql.includes('native_rr_resumes WHERE id')) return { id: 'resume-1' };
        if (sql.includes('remoteradar_application_pack_charges WHERE user_id')) return { ...charge };
        if (sql.includes('remoteradar_credit_grants')) return { id: 'grant-1', credits_total: 2 };
        if (sql.includes('native_rr_application_packs WHERE id')) return packRow;
        if (sql.includes('native_rr_application_pack_versions WHERE id')) return versionRow;
        return null;
      },
      all: async () => ({ results: [] }),
      run: async () => {
        if (sql.includes("SET grant_id = ?1") && sql.includes("status = 'claiming'")) {
          charge.grant_id = args[0]; charge.attempt = args[1]; charge.status = 'claiming'; charge.updated_at = args[2];
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes("wallet_reservation_id = ?1, status = 'reserved'")) {
          if (options.failReservationRecord) throw new Error('RESERVATION_RECORD_FAILED');
          charge.wallet_reservation_id = args[0]; charge.status = 'reserved';
          charge.updated_at = args[1];
        }
        if (sql.includes("status = 'settled'")) charge.status = 'settled';
        if (sql.includes("status = 'released'")) charge.status = 'released';
        return { success: true, meta: { changes: 1 } };
      },
      __sql: sql, __args: args,
    }),
  }));
  const batch = vi.fn(async (statements: Array<{ __sql: string; __args: unknown[] }>) => {
    if (options.failArtifactWrite) throw new Error('ARTIFACT_WRITE_FAILED');
    const packArgs = statements[0]!.__args;
    const versionArgs = statements[1]!.__args;
    packRow = { id: packArgs[0], saved_job_id: packArgs[2], resume_id: packArgs[3], approved_version_id: null, created_at: packArgs[4], updated_at: packArgs[4] };
    versionRow = { id: versionArgs[0], pack_id: versionArgs[2], version: 1, resume_snapshot: versionArgs[3], cover_letter: versionArgs[4], answers: versionArgs[5], approved_at: null, created_at: versionArgs[6] };
    charge.result_pack_id = packArgs[0]; charge.result_version_id = versionArgs[0];
    return [];
  });
  return { DB: { prepare, batch }, charge, prepare, batch };
}

describe('native RemoteRadar applications adapter', () => {
  beforeEach(() => vi.clearAllMocks());
  it('settles exactly one reserved credit and replays the same pack without another charge', async () => {
    authenticateNativeUser.mockResolvedValue({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    remoteRadarAllowanceStatus.mockResolvedValue({ totalRemaining: 2 });
    nativeWalletMutate.mockResolvedValue({ availableBalance: 2 });
    nativeWalletReserve.mockResolvedValue({ id: 'wallet-res-1' });
    nativeWalletFinish.mockResolvedValue({ status: 'settled' });
    const state = meteredDatabase();
    const request = () => new Request(`${baseUrl}/application-packs`, { method: 'POST', body: JSON.stringify({
      idempotencyKey: 'generation-1', savedJobId: 'job-1', resumeId: 'resume-1', resumeSnapshot: { skills: ['TypeScript'] }, coverLetter: 'Hello', answers: {},
    }) });

    const created = await tryNativeRemoteRadarApplications(request(), state as never);
    expect(created?.status).toBe(201);
    expect(nativeWalletReserve).toHaveBeenCalledTimes(1);
    expect(nativeWalletFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'settle' }));
    expect(state.charge.status).toBe('settled');

    const replay = await tryNativeRemoteRadarApplications(request(), state as never);
    expect(replay?.status).toBe(201);
    expect(nativeWalletReserve).toHaveBeenCalledTimes(1);
    expect(state.batch).toHaveBeenCalledTimes(1);
    await expect(replay?.json()).resolves.toMatchObject({ data: { id: state.charge.result_pack_id } });
  });

  it('releases both wallet reservation and claimed grant when pack persistence fails', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    remoteRadarAllowanceStatus.mockResolvedValueOnce({ totalRemaining: 2 });
    nativeWalletMutate.mockResolvedValueOnce({ availableBalance: 2 });
    nativeWalletReserve.mockResolvedValueOnce({ id: 'wallet-res-1' });
    nativeWalletFinish.mockResolvedValueOnce({ status: 'released' });
    const state = meteredDatabase({ failArtifactWrite: true });
    const result = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/application-packs`, { method: 'POST', body: JSON.stringify({
      idempotencyKey: 'generation-1', savedJobId: 'job-1', resumeId: 'resume-1', resumeSnapshot: { skills: ['TypeScript'] }, coverLetter: 'Hello', answers: {},
    }) }), state as never);
    expect(result?.status).toBe(503);
    expect(nativeWalletFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'release' }));
    expect(state.charge.status).toBe('released');
  });

  it('releases a wallet hold when recording the reservation fails after the hold succeeds', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    remoteRadarAllowanceStatus.mockResolvedValueOnce({ totalRemaining: 2 });
    nativeWalletMutate.mockResolvedValueOnce({ availableBalance: 2 });
    nativeWalletReserve.mockResolvedValueOnce({ id: 'wallet-res-1' });
    nativeWalletFinish.mockResolvedValueOnce({ status: 'released' });
    const state = meteredDatabase({ failReservationRecord: true });
    const result = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/application-packs`, { method: 'POST', body: JSON.stringify({
      idempotencyKey: 'generation-1', savedJobId: 'job-1', resumeId: 'resume-1', resumeSnapshot: { skills: ['TypeScript'] }, coverLetter: 'Hello', answers: {},
    }) }), state as never);
    expect(result?.status).toBe(503);
    expect(nativeWalletFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reservationId: 'wallet-res-1', action: 'release' }));
    expect(state.charge.status).toBe('released');
  });

  it('recovers a stale orphaned hold before retrying the same generation', async () => {
    authenticateNativeUser.mockResolvedValueOnce({ id: 'user-1', email: 'u@example.com', username: 'u', role: 'USER' });
    remoteRadarAllowanceStatus.mockResolvedValueOnce({ totalRemaining: 2 });
    nativeWalletMutate.mockResolvedValueOnce({ availableBalance: 2 });
    nativeWalletReserve.mockResolvedValueOnce({ id: 'wallet-res-2' });
    nativeWalletFinish.mockResolvedValue({ status: 'released' });
    const state = meteredDatabase();
    Object.assign(state.charge, { status: 'reserved', wallet_reservation_id: 'wallet-res-stale', attempt: 1, updated_at: '2026-01-01T00:00:00.000Z' });
    const result = await tryNativeRemoteRadarApplications(new Request(`${baseUrl}/application-packs`, { method: 'POST', body: JSON.stringify({
      idempotencyKey: 'generation-1', savedJobId: 'job-1', resumeId: 'resume-1', resumeSnapshot: { skills: ['TypeScript'] }, coverLetter: 'Hello', answers: {},
    }) }), state as never);
    expect(result?.status).toBe(201);
    expect(nativeWalletFinish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reservationId: 'wallet-res-stale', action: 'release' }));
    expect(nativeWalletReserve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idempotencyKey: 'remoteradar-pack:charge-1:2' }));
    expect(state.charge.status).toBe('settled');
  });

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

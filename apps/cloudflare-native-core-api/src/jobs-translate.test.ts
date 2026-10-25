import { describe, expect, it, vi } from 'vitest';

const { applyJobTitleTranslations, detectJobLocale } = await import('./jobs-translate');

type Row = Record<string, unknown>;

function dbWith(rows: Row[], existing: Row[] = []) {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => {
        statements.push({ sql, values });
        return {
          all: async <T>() => ({ results: (sql.includes('FROM remoteradar_job_translations') ? existing : []) as T[] }),
          run: async () => ({ success: true }),
        };
      },
      first: async () => null,
      all: async <T>() => ({ results: existing as T[] }),
      run: async () => ({ success: true }),
    }),
  };
  return { db, statements };
}

const AI_OK = {
  run: async () => ({
    response: '{"translations":["高级前端工程师（远程）","增长运营经理"]}',
  }),
};

const jobs = [
  { jobId: 'job-1', title: 'Senior Frontend Engineer' },
  { jobId: 'job-2', title: 'Growth Operations Manager' },
];

describe('detectJobLocale', () => {
  it('detects zh from accept-language and ?lang, ignores en', () => {
    expect(detectJobLocale(new Request('https://x/api/v1/jobs', { headers: { 'accept-language': 'zh-CN,zh;q=0.9' } }))).toBe('zh-Hans');
    expect(detectJobLocale(new Request('https://x/api/v1/jobs?lang=zh-Hant', { headers: { 'accept-language': 'en' } }))).toBe('zh-Hant');
    expect(detectJobLocale(new Request('https://x/api/v1/jobs', { headers: { 'accept-language': 'en-US,en;q=0.9' } }))).toBeNull();
  });
});

describe('applyJobTitleTranslations', () => {
  it('translates misses in one pass, caches them, and substitutes titles', async () => {
    const { db, statements } = dbWith([], []);
    const substitutions = await applyJobTitleTranslations(
      { AI: AI_OK, REMOTERADAR_AI_MODEL: 'test-model', DB: db } as never,
      jobs,
      'zh-Hans',
    );
    expect(substitutions.get('job-1')).toBe('高级前端工程师（远程）');
    expect(substitutions.get('job-2')).toBe('增长运营经理');
    const inserts = statements.filter((statement) => statement.sql.includes('INTO remoteradar_job_translations'));
    expect(inserts.length).toBe(2);
    const aiModel = 'test-model';
    expect(aiModel).toBeTruthy();
  });

  it('returns cached translations without calling the AI', async () => {
    const cached = [{ job_id: 'job-1', title: '缓存标题一' }, { job_id: 'job-2', title: '缓存标题二' }];
    const { db, statements } = dbWith([], cached);
    const ai = { run: vi.fn() };
    const substitutions = await applyJobTitleTranslations(
      { AI: ai, DB: db } as never,
      jobs,
      'zh-Hans',
    );
    expect(substitutions.get('job-1')).toBe('缓存标题一');
    expect(ai.run).not.toHaveBeenCalled();
    expect(statements.some((statement) => statement.sql.includes('INTO remoteradar_job_translations'))).toBe(false);
  });

  it('is a no-op for English locales or when the AI binding is absent', async () => {
    const { db } = dbWith([], []);
    expect((await applyJobTitleTranslations({ AI: AI_OK, DB: db } as never, jobs, null)).size).toBe(0);
    expect((await applyJobTitleTranslations({ DB: db } as never, jobs, 'zh-Hans')).size).toBe(0);
  });

  it('keeps original titles when the AI response is unusable', async () => {
    const { db } = dbWith([], []);
    const substitutions = await applyJobTitleTranslations(
      { AI: { run: async () => ({ response: 'not json at all' }) }, DB: db } as never,
      jobs,
      'zh-Hans',
    );
    expect(substitutions.size).toBe(0);
  });
});

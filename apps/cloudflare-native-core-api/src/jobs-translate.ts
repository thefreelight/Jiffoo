import type { NativeJobsProxyEnv } from './jobs-proxy';

export interface JobTitleTranslationEnv extends NativeJobsProxyEnv {
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  REMOTERADAR_AI_MODEL?: string;
  DB?: {
    prepare(query: string): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results?: T[] }>;
      bind(...values: unknown[]): { all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> };
    };
  };
}

export interface TranslatableJob {
  jobId: string;
  title: string;
}

const TARGET_LOCALES = new Set(['zh-hans', 'zh-hant', 'zh', 'zh-cn', 'zh-tw']);

const LOCALE_COLUMN: Record<string, string> = {
  'zh-hans': 'zh-Hans',
  'zh-hant': 'zh-Hant',
  'zh': 'zh-Hans',
  'zh-cn': 'zh-Hans',
  'zh-tw': 'zh-Hant',
};

/** True when the request's language preferences ask for a translatable locale. */
export function detectJobLocale(request: Request): string | null {
  const explicit = new URL(request.url).searchParams.get('lang')?.toLowerCase() ?? null;
  if (explicit && TARGET_LOCALES.has(explicit)) {
    return LOCALE_COLUMN[explicit] ?? 'zh-Hans';
  }
  const header = request.headers.get('accept-language') || '';
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]!.trim().toLowerCase();
    if (tag.startsWith('zh')) return LOCALE_COLUMN[tag] ?? 'zh-Hans';
    if (tag.startsWith('en')) return null;
  }
  return null;
}

export function isTranslatableJobLocale(locale: string | null): locale is 'zh-Hans' | 'zh-Hant' {
  return locale === 'zh-Hans' || locale === 'zh-Hant';
}

interface TranslationRow {
  job_id: string;
  title: string;
}

async function readCachedTitles(
  env: JobTitleTranslationEnv,
  locale: 'zh-Hans' | 'zh-Hant',
  jobIds: string[],
): Promise<Map<string, string>> {
  const cached = new Map<string, string>();
  if (!env.DB || jobIds.length === 0) return cached;
  const placeholders = jobIds.map((_, index) => `?${index + 2}`).join(',');
  const { results } = await env.DB.prepare(
    `SELECT job_id, title FROM remoteradar_job_translations WHERE locale = ?1 AND job_id IN (${placeholders})`,
  ).bind(locale, ...jobIds).all<TranslationRow>();
  for (const row of results ?? []) cached.set(row.job_id, row.title);
  return cached;
}

async function translateTitles(
  env: JobTitleTranslationEnv,
  locale: 'zh-Hans' | 'zh-Hant',
  jobs: TranslatableJob[],
): Promise<Map<string, string>> {
  const translated = new Map<string, string>();
  if (!env.AI || jobs.length === 0) return translated;
  const model = env.REMOTERADAR_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const targetLanguage = locale === 'zh-Hant' ? 'Traditional Chinese' : 'Simplified Chinese';
  const lines = jobs.map((job, index) => `${index + 1}. ${job.title}`);
  try {
    const result = await env.AI.run(model, {
      messages: [
        {
          role: 'system',
          content: `You translate remote-job titles for a job board. Translate each numbered job title into ${targetLanguage}. Keep company names, product names, and seniority abbreviations (Senior, Jr, Staff) recognizable. Reply with ONLY a JSON object {"translations":["...","..."]} whose array items match the input order and count.`,
        },
        { role: 'user', content: lines.join('\n') },
      ],
      max_tokens: 1024,
    }) as { response?: string };
    const text = result?.response || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return translated;
    const parsed = JSON.parse(jsonMatch[0]) as { translations?: string[] };
    const list = Array.isArray(parsed.translations) ? parsed.translations : [];
    jobs.forEach((job, index) => {
      const value = list[index];
      if (typeof value === 'string' && value.trim()) translated.set(job.jobId, value.trim());
    });
  } catch {
    // Translation is best-effort: the original titles render on any failure.
  }
  return translated;
}

async function cacheTitles(
  env: JobTitleTranslationEnv,
  locale: 'zh-Hans' | 'zh-Hant',
  translations: Map<string, string>,
): Promise<void> {
  if (!env.DB || translations.size === 0) return;
  for (const [jobId, title] of translations) {
    await env.DB.prepare(
      `INSERT INTO remoteradar_job_translations (job_id, locale, title) VALUES (?1, ?2, ?3)
       ON CONFLICT(job_id, locale) DO NOTHING`,
    ).bind(jobId, locale, title).run();
  }
}

/**
 * Substitutes job titles with cached (or freshly translated) per-locale
 * versions. Original titles stay in `titleOriginal`; upstream titles are
 * returned untouched for English locales or when no AI binding exists.
 */
export async function applyJobTitleTranslations(
  env: JobTitleTranslationEnv,
  jobs: TranslatableJob[],
  locale: string | null,
): Promise<Map<string, string>> {
  const substitutions = new Map<string, string>();
  if (!isTranslatableJobLocale(locale) || jobs.length === 0) return substitutions;
  if (!env.AI || !env.DB) return substitutions;
  const unique = new Map<string, TranslatableJob>();
  for (const job of jobs) {
    if (job.jobId && job.title) unique.set(job.jobId, job);
  }
  const jobList = [...unique.values()];
  const cached = await readCachedTitles(env, locale, jobList.map((job) => job.jobId));
  for (const [jobId, title] of cached) substitutions.set(jobId, title);
  const misses = jobList.filter((job) => !cached.has(job.jobId));
  if (misses.length === 0) return substitutions;
  // Translate every unseen title on this page in parallel batches of 12 —
  // one-time cost, cached from then on.
  const batches: TranslatableJob[][] = [];
  for (let index = 0; index < misses.length; index += 12) batches.push(misses.slice(index, index + 12));
  const settled = await Promise.all(batches.map((batch) => translateTitles(env, locale, batch)));
  const fresh = new Map<string, string>();
  for (const batch of settled) for (const [jobId, title] of batch) fresh.set(jobId, title);
  if (fresh.size > 0) {
    for (const [jobId, title] of fresh) substitutions.set(jobId, title);
    await cacheTitles(env, locale, fresh);
  }
  return substitutions;
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/database', () => {
  const store = new Map<string, Record<string, unknown>>();
  let seq = 0;

  const clone = (value: Record<string, unknown>) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

  const prisma = {
    extensionSubmission: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; slug_version?: { slug: string; version: string } } }) => {
        for (const record of store.values()) {
          if (where.id && record.id === where.id) return clone(record);
          if (
            where.slug_version &&
            record.slug === where.slug_version.slug &&
            record.version === where.slug_version.version
          ) {
            return clone(record);
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { id: `sub-${++seq}`, createdAt: new Date().toISOString(), ...clone(data) };
        store.set(record.id as string, record);
        return clone(record);
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const record = store.get(where.id);
        if (!record) throw new Error('not found');
        const updated = { ...record, ...clone(data) };
        store.set(where.id, updated);
        return clone(updated);
      }),
      findMany: vi.fn(async () => Array.from(store.values()).map(clone)),
    },
  };

  return { prisma };
});

import { prisma } from '@/config/database';
import { MarketplaceSubmissionsService, SubmissionError } from '@/core/marketplace-submissions/service';
import { validateSubmission } from '@/core/marketplace-submissions/validation';

const service = new MarketplaceSubmissionsService(prisma as never);

let seq = 0;

function pluginSubmissionFixture() {
  seq += 1;
  const slug = `my-plugin-${seq}`;
  return {
    kind: 'plugin',
    slug,
    name: 'My Plugin',
    version: '0.0.1',
    contractVersion: 'v1',
    category: 'integration',
    description: 'Bridges outbound webhooks to an external automation service.',
    developerName: 'Dev One',
    developerEmail: 'dev@example.com',
    sourceUrl: 'https://github.com/example/my-plugin',
    manifest: {
      id: slug,
      version: '0.0.1',
      contract: 'v1',
      category: 'integration',
      uses: ['api', 'events'],
      capabilities: ['webhook.receive'],
    },
  };
}

describe('validateSubmission', () => {
  it('passes a well-formed plugin submission', () => {
    const report = validateSubmission(pluginSubmissionFixture() as never);
    expect(report.ok).toBe(true);
    expect(report.issues.filter((issue) => issue.level === 'error')).toHaveLength(0);
  });

  it('rejects a bad slug and mismatched manifest id', () => {
    const fixture = pluginSubmissionFixture();
    const report = validateSubmission({
      ...fixture,
      slug: 'Bad Slug',
      manifest: { ...fixture.manifest, id: 'other' },
    } as never);
    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain('envelope.slug_format');
    expect(report.issues.map((issue) => issue.code)).toContain('plugin.manifest_id_mismatch');
  });

  it('requires poweredBy on themes', () => {
    const report = validateSubmission({
      kind: 'theme',
      slug: 'my-theme',
      name: 'My Theme',
      version: '0.1.0',
      description: 'A storefront theme for wellness brands.',
      developerName: 'Dev One',
      developerEmail: 'dev@example.com',
      manifest: {
        slug: 'my-theme',
        version: '0.1.0',
        target: 'shop',
        entry: { tokensCSS: 'tokens.css' },
      },
    } as never);
    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain('theme.powered_by');
  });
});

describe('MarketplaceSubmissionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a draft with the validation report attached', async () => {
    const { submission, validation } = await service.createSubmission(pluginSubmissionFixture());
    expect(submission.status).toBe('draft');
    expect(validation.ok).toBe(true);
  });

  it('blocks submission while validation errors exist, then allows after artifact + submit', async () => {
    const created = await service.createSubmission(pluginSubmissionFixture());
    const id = (created.submission as { id: string }).id;

    await expect(service.submitForReview(id)).rejects.toMatchObject({ code: 'SUBMISSION_VALIDATION_FAILED' });

    await service.setArtifact(id, 'https://example.com/my-plugin-0.0.1.zip', 'abc');
    const submitted = await service.submitForReview(id);
    expect((submitted as { status: string }).status).toBe('submitted');

    const approved = await service.approve(id, { notes: 'Looks good', reviewer: 'admin@example.com' });
    expect((approved as { status: string }).status).toBe('approved');
  });

  it('enforces the state machine on review actions', async () => {
    const created = await service.createSubmission(pluginSubmissionFixture());
    const id = (created.submission as { id: string }).id;
    await expect(service.approve(id, { notes: 'early', reviewer: 'admin' })).rejects.toMatchObject({
      code: 'SUBMISSION_INVALID_TRANSITION',
    });
  });

  it('rejects duplicate slug@version', async () => {
    const fixture = pluginSubmissionFixture();
    await service.createSubmission(fixture);
    await expect(service.createSubmission({ ...fixture })).rejects.toMatchObject({
      code: 'SUBMISSION_DUPLICATE',
    });
  });

  it('rejects an unknown kind with a 400', async () => {
    await expect(
      service.createSubmission({ ...pluginSubmissionFixture(), kind: 'widget' } as never),
    ).rejects.toMatchObject({ code: 'SUBMISSION_KIND_INVALID', statusCode: 400 });
  });
});

import { prisma } from '@/config/database';
import { audit } from '@/core/admin/extension-installer/theme-runtime';

export const STOREFRONT_CODE_ID = 'system';
export const codeDefaults = {
  enabled: true,
  ga4MeasurementId: null as string | null,
  metaPixelId: null as string | null,
  baiduSiteKey: null as string | null,
  headCode: '',
  bodyStartCode: '',
  bodyEndCode: '',
};
export type CodeValues = typeof codeDefaults;
export type CodeInput = Omit<CodeValues, 'enabled'>;
const fields = Object.keys(codeDefaults) as Array<keyof CodeValues>;
const editableFields = fields.filter((field): field is keyof CodeInput => field !== 'enabled');

export class StorefrontCodeError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
  }
}

function conflict(): never {
  throw new StorefrontCodeError(409, 'STOREFRONT_CODE_CONFIG_CONFLICT', 'Configuration revision conflict');
}

export async function getCurrentCode() {
  const current = await prisma.storefrontCodeConfiguration.findUnique({ where: { id: STOREFRONT_CODE_ID } });
  if (!current) return { ...codeDefaults, revision: 0, updatedById: null, updatedAt: null };
  const { id: _id, ...configuration } = current;
  return configuration;
}

export async function getPublicCode() {
  const current = await prisma.storefrontCodeConfiguration.findUnique({ where: { id: STOREFRONT_CODE_ID } });
  const values = current?.enabled ? current : codeDefaults;
  return {
    ga4MeasurementId: values.ga4MeasurementId, metaPixelId: values.metaPixelId,
    baiduSiteKey: values.baiduSiteKey, headCode: values.headCode,
    bodyStartCode: values.bodyStartCode, bodyEndCode: values.bodyEndCode,
  };
}

type Mutation =
  | { action: 'save'; values: CodeInput; expectedRevision: number }
  | { action: 'switch'; enabled: boolean }
  | { action: 'restore'; revision: number; expectedRevision: number };

export async function mutateCode(actorId: string, mutation: Mutation) {
  return prisma.$transaction(async (tx) => {
    // Serialize the singleton, including its absent-row state and unconditional switch changes.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('jiffoo.storefront-code'))::text`;
    const current = await tx.storefrontCodeConfiguration.findUnique({ where: { id: STOREFRONT_CODE_ID } });
    const fromRevision = current?.revision ?? 0;
    if (mutation.action !== 'switch' && mutation.expectedRevision !== fromRevision) conflict();
    let values: CodeValues;
    let restoredFromRevision: number | null = null;
    if (mutation.action === 'restore') {
      const snapshot = await tx.storefrontCodeRevision.findUnique({ where: { revision: mutation.revision } });
      if (!snapshot) throw new StorefrontCodeError(404, 'NOT_FOUND', 'Configuration revision not found');
      values = {
        ...Object.fromEntries(editableFields.map((field) => [field, snapshot[field]])) as CodeInput,
        enabled: current?.enabled ?? codeDefaults.enabled,
      };
      restoredFromRevision = snapshot.revision;
    } else if (mutation.action === 'switch') {
      values = { ...(current ?? codeDefaults), enabled: mutation.enabled };
    } else values = { ...mutation.values, enabled: current?.enabled ?? codeDefaults.enabled };
    const nextValues = Object.fromEntries(fields.map((field) => [field, values[field]])) as CodeValues;
    const revision = fromRevision + 1;
    const updatedAt = new Date();
    const data = { ...nextValues, revision, updatedById: actorId, updatedAt };
    if (current) {
      const changed = await tx.storefrontCodeConfiguration.updateMany({
        where: { id: STOREFRONT_CODE_ID, revision: fromRevision }, data,
      });
      if (changed.count !== 1) conflict();
    } else {
      await tx.storefrontCodeConfiguration.create({ data: { id: STOREFRONT_CODE_ID, ...data } });
    }
    await tx.storefrontCodeRevision.create({
      data: { ...data, createdById: actorId, restoredFromRevision },
    });
    const auditFields = mutation.action === 'switch' ? fields : editableFields;
    const changedFields = auditFields.filter((field) => (current ?? codeDefaults)[field] !== nextValues[field]);
    await audit(tx, actorId, `storefront-code.${mutation.action}`, STOREFRONT_CODE_ID, {
      fromRevision, toRevision: revision, changedFields,
      ...(mutation.action === 'restore' ? { restoredFromRevision } : {}),
    }, 'storefront-code');
    return data;
  });
}

export async function listCodeRevisions(page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.storefrontCodeRevision.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit,
    }),
    prisma.storefrontCodeRevision.count(),
  ]);
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getCodeRevision(revision: number) {
  const snapshot = await prisma.storefrontCodeRevision.findUnique({ where: { revision } });
  if (!snapshot) throw new StorefrontCodeError(404, 'NOT_FOUND', 'Configuration revision not found');
  return snapshot;
}

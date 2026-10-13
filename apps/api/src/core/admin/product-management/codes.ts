import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { PRODUCT_CODE_GENERATION } from 'shared';

type CodeField = 'spuCode' | 'skuCode';
type Attempt = { field: CodeField; value: string; generated: boolean; name: string; variantIndex?: number; variantId?: string };
export type CodeContext = { current?: Attempt };
type CodeDatabase = Pick<Prisma.TransactionClient, '$queryRaw'>;

export function randomSpuCode(): string {
  const { alphabet, length } = PRODUCT_CODE_GENERATION;
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

async function owner(tx: CodeDatabase, field: CodeField, value: string, excludeId?: string) {
  // Exact lower() equality uses the unique index and treats underscores literally.
  const rows = field === 'spuCode'
    ? await tx.$queryRaw<Array<{ name: string }>>`SELECT name FROM public.products
        WHERE lower("spuCode") = lower(${value}) AND (${excludeId ?? null}::text IS NULL OR id <> ${excludeId ?? null}) LIMIT 1`
    : await tx.$queryRaw<Array<{ name: string }>>`SELECT p.name FROM public.product_variants v
        JOIN public.products p ON p.id = v."productId"
        WHERE lower(v."skuCode") = lower(${value}) AND (${excludeId ?? null}::text IS NULL OR v.id <> ${excludeId ?? null}) LIMIT 1`;
  return rows[0];
}

function conflict(attempt: Attempt, name: string) {
  return new ApiError(attempt.field === 'spuCode' ? 'SPU_CODE_TAKEN' : 'SKU_CODE_TAKEN', {
    field: attempt.field, name, variantIndex: attempt.variantIndex, variantId: attempt.variantId,
  });
}

export async function resolveProductCode(tx: CodeDatabase, context: CodeContext, options: {
  field: CodeField; input?: string; existing?: string; excludeId?: string; spuCode?: string;
  name: string; variantIndex?: number; variantId?: string;
}): Promise<string> {
  const { field, input, existing, excludeId, name, variantIndex, variantId } = options;
  // Legacy codes are accepted only when their stored value is unchanged.
  if (existing !== undefined && (input === undefined || input.trim() === existing)) return existing;
  const value = input?.trim() ?? '';
  if (value && !/^[A-Za-z0-9_.-]{1,64}$/.test(value)) {
    throw new ApiError('INVALID_PRODUCT_CODE', { field, variantIndex, variantId });
  }
  const generated = value === '';
  let position = 1;
  for (let attempt = 0; attempt < (field === 'spuCode' ? 10 : 10000); attempt++) {
    const candidate = value || (field === 'spuCode' ? randomSpuCode()
      : options.spuCode!.toUpperCase() + '-' + String(position++).padStart(2, '0'));
    const current = { field, value: candidate, generated, name, variantIndex, variantId };
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(candidate)) throw new ApiError('INVALID_PRODUCT_CODE', { field, variantIndex, variantId });
    context.current = current;
    const taken = await owner(tx, field, candidate, excludeId);
    if (!taken) return candidate;
    if (!generated) throw conflict(current, taken.name);
    if (attempt === (field === 'spuCode' ? 9 : 9999)) throw conflict(current, taken.name);
  }
  throw new ApiError(field === 'spuCode' ? 'SPU_CODE_TAKEN' : 'SKU_CODE_TAKEN', { field, name, variantIndex, variantId });
}

export async function withProductCodeRetry<T>(operation: (context: CodeContext) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const context: CodeContext = {};
    try { return await operation(context); }
    catch (error) {
      const current = context.current;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || !current) throw error;
      // PostgreSQL aborts the transaction on a unique violation. Retry the whole operation.
      // Prisma may report expression-index targets as unavailable; confirm the owner after rollback.
      const taken = await owner(prisma, current.field, current.value);
      if (!taken) throw error;
      if (current.generated && attempt < 9) continue;
      throw conflict(current, taken?.name ?? current.name);
    }
  }
  throw new ApiError('SPU_CODE_TAKEN');
}

import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { CacheService } from '@/core/cache/service';
import { systemSettingsService } from '@/core/settings/service';
import { currencyExponent, decimalToMinor, minorToDecimal, MoneyError } from '@/core/shared/money';
import { productCount, productIds, type ProductSelection } from './list-query';
import { isPriceRepresentable, lockProductVariantRows } from './service';

/**
 * Admin bulk price edit.
 *
 * The operator selects many products and changes the price of their variants
 * in one action. Every price is computed in the minor units of the store
 * currency, so no rounding error of the double kind can enter, and every
 * write is a conditional update that carries the price it was computed from.
 */

/** How a price edit changes the price of a variant. */
export type BulkPriceEditMode = 'amount' | 'percentage';

/** One price edit: an absolute amount or a percentage of the current price. */
export interface BulkPriceEdit {
  mode: BulkPriceEditMode;
  /** The new price, or the change of the price, as a decimal string. */
  value: string;
}

export interface ProductBulkPricesRequest {
  selection: ProductSelection;
  salePrice?: BulkPriceEdit;
  compareAtPrice?: BulkPriceEdit;
  clearCompareAtPrice?: boolean;
  dryRun?: boolean;
}

/** Why one variant was not written. */
export type BulkPriceVariantSkipReason =
  | 'PRICE_NOT_REPRESENTABLE'
  | 'NEGATIVE_PRICE'
  | 'COMPARE_AT_BELOW_SALE'
  | 'COMPARE_AT_MISSING'
  | 'CHANGED_CONCURRENTLY';

/** Why one product was not written. */
export type BulkPriceProductSkipReason = 'NOT_FOUND';

export interface BulkPriceVariantSkip {
  variantId: string;
  productId: string;
  productName: string;
  reason: BulkPriceVariantSkipReason;
}

export interface BulkPriceChange {
  variantId: string;
  productId: string;
  productName: string;
  previousSalePrice: number;
  salePrice: number;
  previousCompareAtPrice: number | null;
  compareAtPrice: number | null;
}

export interface ProductBulkPricesResult {
  matched: number;
  processed: number;
  skippedCount: number;
  skipped: { id: string; name: string; reason: BulkPriceProductSkipReason }[];
  variantsProcessed: number;
  variantsSkippedCount: number;
  variantsSkipped: BulkPriceVariantSkip[];
  changes: BulkPriceChange[];
}

/** The prices of one variant before and after the edit. */
interface VariantPrices {
  previousSalePrice: number;
  previousCompareAtPrice: number | null;
  nextSalePrice: string;
  nextCompareAtPrice: string | null;
  /** Whether the edit changes the stored prices of the variant at all. */
  changed: boolean;
}

type VariantOutcome = { ok: true; prices: VariantPrices } | { ok: false; reason: BulkPriceVariantSkipReason };

/** The parsed decimal text of a price, split into its sign and its digits. */
interface DecimalText {
  negative: boolean;
  whole: string;
  fraction: string;
}

function parseDecimalText(text: string): DecimalText {
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(String(text).trim());
  if (!match) throw new ApiError('INTERNAL_SERVER_ERROR');
  const whole = match[2].replace(/^0+(?=\d)/, '');
  const fraction = match[3] ?? '';
  const zero = whole === '0' && /^[0]*$/.test(fraction);
  return { negative: match[1] === '-' && !zero, whole, fraction };
}

/** Compare the magnitude of two decimal texts. */
function compareMagnitude(left: DecimalText, right: DecimalText): number {
  if (left.whole.length !== right.whole.length) return left.whole.length < right.whole.length ? -1 : 1;
  if (left.whole !== right.whole) return left.whole < right.whole ? -1 : 1;
  const leftFraction = left.fraction.replace(/0+$/, '');
  const rightFraction = right.fraction.replace(/0+$/, '');
  const length = Math.max(leftFraction.length, rightFraction.length);
  const leftPadded = leftFraction.padEnd(length, '0');
  const rightPadded = rightFraction.padEnd(length, '0');
  if (leftPadded === rightPadded) return 0;
  return leftPadded < rightPadded ? -1 : 1;
}

/**
 * Compare two decimal texts exactly.
 *
 * The comparison never touches a double: the texts are compared digit by
 * digit, so a price of `99.99` and a price of `99.990` are the same price.
 */
function compareDecimals(left: string, right: string): number {
  const leftText = parseDecimalText(left);
  const rightText = parseDecimalText(right);
  if (leftText.negative !== rightText.negative) return leftText.negative ? -1 : 1;
  const magnitude = compareMagnitude(leftText, rightText);
  return leftText.negative ? -magnitude : magnitude;
}

/**
 * Parse a percentage into an integer scaled by one hundred.
 *
 * The percentage is read from its decimal text, never from a double, so
 * `12.5` is exactly twelve and a half percent and not the closest double to
 * it.
 */
function parsePercentageScaled(value: string, path: string): bigint {
  const raw = String(value ?? '').trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    throw new ApiError('VALIDATION_ERROR', { issues: [{ path, message: 'The percentage must be a decimal number', code: 'INVALID_PERCENTAGE' }] });
  }
  const fraction = match[3] ?? '';
  if (fraction.length > 2) {
    throw new ApiError('VALIDATION_ERROR', { issues: [{ path, message: 'The percentage accepts at most two decimal places', code: 'TOO_MANY_DECIMAL_PLACES' }] });
  }
  const magnitude = BigInt(match[2]) * 100n + BigInt((fraction + '00').slice(0, 2));
  const scaled = match[1] === '-' ? -magnitude : magnitude;
  if (scaled < -10000n) {
    throw new ApiError('VALIDATION_ERROR', { issues: [{ path, message: 'The percentage must be at least -100', code: 'PERCENTAGE_OUT_OF_RANGE' }] });
  }
  return scaled;
}

/**
 * Round a fraction away from zero when it is at least one half.
 *
 * The numerator and the denominator are integers, so the rounding never
 * depends on a double.
 */
function roundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const quotient = magnitude / denominator;
  const remainder = magnitude % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/**
 * Scale a price by a percentage, in the minor units of the store currency.
 *
 * The factor is `(10000 + pctScaled) / 10000`, because the percentage is
 * scaled by one hundred.
 */
function applyPercentage(currentMinor: number, pctScaled: bigint): number {
  const next = roundHalfAwayFromZero(BigInt(currentMinor) * (10000n + pctScaled), 10000n);
  if (next > BigInt(Number.MAX_SAFE_INTEGER) || next < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError('OUT_OF_SAFE_RANGE', 'The price exceeds the range of the store');
  }
  return Number(next);
}

/**
 * Convert an absolute amount into the minor units of the store currency.
 *
 * The money module refuses an amount the currency cannot hold, and that
 * refusal is a validation error of the request, never a crash.
 */
function amountToMinor(value: string, currency: string, path: string): number {
  try {
    return decimalToMinor(value, currency);
  } catch (error) {
    if (error instanceof MoneyError) {
      throw new ApiError('VALIDATION_ERROR', { issues: [{ path, message: error.detail, code: error.reason }] });
    }
    throw error;
  }
}

/**
 * Read the minor units of a stored price.
 *
 * A stored price the currency of the store cannot hold has no minor units,
 * and a percentage cannot be computed from it.
 */
function storedPriceToMinor(text: string, currency: string): number | null {
  try {
    return decimalToMinor(text, currency);
  } catch {
    return null;
  }
}

/** Whether a price is representable in the currency of the store. */
function isRepresentable(text: string, exponent: number): boolean {
  return isPriceRepresentable(Number(text), exponent);
}

/**
 * Compute the prices of one variant.
 *
 * A variant is never half applied: when one of the two prices cannot be
 * computed or breaks a rule of the price, the whole variant is skipped.
 */
function computeVariantPrices(params: {
  currentSalePrice: string;
  currentCompareAtPrice: string | null;
  saleAmountMinor: number | null;
  salePercentage: bigint | null;
  compareAmountMinor: number | null;
  comparePercentage: bigint | null;
  clearCompareAtPrice: boolean;
  currency: string;
  exponent: number;
}): VariantOutcome {
  const { currentSalePrice, currentCompareAtPrice, currency, exponent } = params;

  let nextSaleMinor: number | null = null;
  if (params.saleAmountMinor !== null) nextSaleMinor = params.saleAmountMinor;
  else if (params.salePercentage !== null) {
    const currentMinor = storedPriceToMinor(currentSalePrice, currency);
    if (currentMinor === null) return { ok: false, reason: 'PRICE_NOT_REPRESENTABLE' };
    nextSaleMinor = applyPercentage(currentMinor, params.salePercentage);
  }

  const compareTouched = params.clearCompareAtPrice || params.compareAmountMinor !== null || params.comparePercentage !== null;
  let nextCompareMinor: number | null = null;
  if (params.clearCompareAtPrice) nextCompareMinor = null;
  else if (params.compareAmountMinor !== null) nextCompareMinor = params.compareAmountMinor;
  else if (params.comparePercentage !== null) {
    if (currentCompareAtPrice === null) return { ok: false, reason: 'COMPARE_AT_MISSING' };
    const currentMinor = storedPriceToMinor(currentCompareAtPrice, currency);
    if (currentMinor === null) return { ok: false, reason: 'PRICE_NOT_REPRESENTABLE' };
    nextCompareMinor = applyPercentage(currentMinor, params.comparePercentage);
  }

  const nextSalePrice = nextSaleMinor === null ? currentSalePrice : minorToDecimal(nextSaleMinor, currency);
  const nextCompareAtPrice = !compareTouched
    ? currentCompareAtPrice
    : nextCompareMinor === null ? null : minorToDecimal(nextCompareMinor, currency);

  // A price the currency of the store cannot hold is refused, never rounded.
  if (nextSaleMinor !== null && !isRepresentable(nextSalePrice, exponent)) return { ok: false, reason: 'PRICE_NOT_REPRESENTABLE' };
  if (nextCompareMinor !== null && !isRepresentable(nextCompareAtPrice as string, exponent)) return { ok: false, reason: 'PRICE_NOT_REPRESENTABLE' };
  if (nextSaleMinor !== null && nextSaleMinor < 0) return { ok: false, reason: 'NEGATIVE_PRICE' };
  if (nextCompareMinor !== null && nextCompareMinor < 0) return { ok: false, reason: 'NEGATIVE_PRICE' };

  const saleChanged = nextSaleMinor !== null && compareDecimals(nextSalePrice, currentSalePrice) !== 0;
  const compareChanged = compareTouched && (nextCompareAtPrice === null
    ? currentCompareAtPrice !== null
    : currentCompareAtPrice === null || compareDecimals(nextCompareAtPrice, currentCompareAtPrice) !== 0);

  // The strike-through price of a variant is never below its sale price.
  if ((saleChanged || compareChanged) && nextCompareAtPrice !== null && compareDecimals(nextCompareAtPrice, nextSalePrice) < 0) {
    return { ok: false, reason: 'COMPARE_AT_BELOW_SALE' };
  }

  return {
    ok: true,
    prices: {
      previousSalePrice: Number(currentSalePrice),
      previousCompareAtPrice: currentCompareAtPrice === null ? null : Number(currentCompareAtPrice),
      nextSalePrice,
      nextCompareAtPrice,
      changed: saleChanged || compareChanged,
    },
  };
}

/**
 * Apply a bulk price edit to the variants of the selected products.
 *
 * The selection is resolved the way the product bulk action resolves it, the
 * products are walked in pages, every product owns one transaction, and the
 * product cache version is bumped once for the whole batch.
 */
export async function bulkPrices(body: ProductBulkPricesRequest): Promise<ProductBulkPricesResult> {
  const currency = await systemSettingsService.getShopCurrency();
  const exponent = currencyExponent(currency);
  const saleEdit = body.salePrice;
  const compareEdit = body.compareAtPrice;
  const clearCompareAtPrice = body.clearCompareAtPrice === true;

  if (!saleEdit && !compareEdit && !clearCompareAtPrice) {
    throw new ApiError('VALIDATION_ERROR', { issues: [{ path: 'salePrice', message: 'A bulk price edit needs a price to change', code: 'REQUIRED' }] });
  }
  if (clearCompareAtPrice && compareEdit) {
    throw new ApiError('VALIDATION_ERROR', { issues: [{ path: 'compareAtPrice', message: 'The compare-at price cannot be changed and cleared at once', code: 'MUTUALLY_EXCLUSIVE' }] });
  }

  const saleAmountMinor = saleEdit?.mode === 'amount' ? amountToMinor(saleEdit.value, currency, 'salePrice') : null;
  const compareAmountMinor = compareEdit?.mode === 'amount' ? amountToMinor(compareEdit.value, currency, 'compareAtPrice') : null;
  const salePercentage = saleEdit?.mode === 'percentage' ? parsePercentageScaled(saleEdit.value, 'salePrice') : null;
  const comparePercentage = compareEdit?.mode === 'percentage' ? parsePercentageScaled(compareEdit.value, 'compareAtPrice') : null;

  const { selection } = body;
  const filter = selection.mode === 'filter' ? selection.filter : {};
  const matched = selection.mode === 'ids' ? new Set(selection.ids).size : await productCount(filter, selection);
  if (selection.mode === 'filter' && matched > 5000) throw new ApiError('VALIDATION_ERROR', { limit: 5000, matched });
  const ids = selection.mode === 'ids' ? [...new Set(selection.ids)] : await productIds(filter, { sortBy: 'name', sortOrder: 'asc' }, 5000, 0, selection);

  const skipped: { id: string; name: string; reason: BulkPriceProductSkipReason }[] = [];
  const variantsSkipped: BulkPriceVariantSkip[] = [];
  const changes: BulkPriceChange[] = [];
  let processed = 0;
  let skippedCount = 0;
  let variantsProcessed = 0;
  let variantsSkippedCount = 0;

  const skipProduct = (id: string, name: string, reason: BulkPriceProductSkipReason) => {
    skippedCount++;
    if (skipped.length < 20) skipped.push({ id, name, reason });
  };
  const skipVariant = (variantId: string, productId: string, productName: string, reason: BulkPriceVariantSkipReason) => {
    variantsSkippedCount++;
    if (variantsSkipped.length < 20) variantsSkipped.push({ variantId, productId, productName, reason });
  };

  try {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const page = ids.slice(offset, offset + 100);
      const products = await prisma.product.findMany({ where: { id: { in: page } }, select: { id: true, name: true } });
      const byId = new Map(products.map(product => [product.id, product]));
      for (const id of page) {
        const product = byId.get(id);
        if (!product) { skipProduct(id, '', 'NOT_FOUND'); continue; }
        let written = 0;
        await prisma.$transaction(async tx => {
          // The variant rows are locked before they are read, so the read and
          // the write of a variant belong to the same locked state.
          await lockProductVariantRows(tx, id);
          const variants = await tx.productVariant.findMany({
            where: { productId: id },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            select: { id: true, salePrice: true, compareAtPrice: true },
          });
          for (const variant of variants) {
            const currentSalePrice = variant.salePrice.toString();
            const currentCompareAtPrice = variant.compareAtPrice === null ? null : variant.compareAtPrice.toString();
            const outcome = computeVariantPrices({
              currentSalePrice,
              currentCompareAtPrice,
              saleAmountMinor,
              salePercentage,
              compareAmountMinor,
              comparePercentage,
              clearCompareAtPrice,
              currency,
              exponent,
            });
            if (outcome.ok === false) { skipVariant(variant.id, id, product.name, outcome.reason); continue; }
            const prices = outcome.prices;
            if (!prices.changed) continue;

            if (!body.dryRun) {
              // The write carries the prices it was computed from, so a
              // concurrent change is never overwritten silently.
              const updated = await tx.productVariant.updateMany({
                where: { id: variant.id, salePrice: variant.salePrice, compareAtPrice: variant.compareAtPrice },
                data: { salePrice: prices.nextSalePrice, compareAtPrice: prices.nextCompareAtPrice },
              });
              if (updated.count === 0) { skipVariant(variant.id, id, product.name, 'CHANGED_CONCURRENTLY'); continue; }
            }
            written++;
            variantsProcessed++;
            if (changes.length < 20) {
              changes.push({
                variantId: variant.id,
                productId: id,
                productName: product.name,
                previousSalePrice: prices.previousSalePrice,
                salePrice: Number(prices.nextSalePrice),
                previousCompareAtPrice: prices.previousCompareAtPrice,
                compareAtPrice: prices.nextCompareAtPrice === null ? null : Number(prices.nextCompareAtPrice),
              });
            }
          }
        }, { timeout: 30000, maxWait: 10000 });
        if (written > 0) processed++;
      }
    }
  } finally {
    // The written products are published with one version bump for the batch.
    if (!body.dryRun && variantsProcessed > 0) await CacheService.incrementProductVersion();
  }

  return { matched, processed, skippedCount, skipped, variantsProcessed, variantsSkippedCount, variantsSkipped, changes };
}

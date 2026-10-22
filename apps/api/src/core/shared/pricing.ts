import { decimalToMinor } from '@/core/shared/money';

export function currentLinePrice(
  variant: { salePrice: { toString(): string } },
  currency: string,
): { unitPrice: number; unitPriceMinor: number } {
  const unitPriceMinor = decimalToMinor(variant.salePrice.toString(), currency);
  return { unitPrice: Number(variant.salePrice), unitPriceMinor };
}

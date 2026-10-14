import type { AdminProductDetailDTO } from 'shared';
import type { ContentTranslation } from '@/components/products/ContentTranslations';
import type { EditableVariant } from '@/components/products/VariantsEditor';

export interface ProductDraft { name: string; spuCode: string; description: string; translations: ContentTranslation[]; categoryId: string | null; requiresShipping: boolean; images: string[]; isActive: boolean; variants: EditableVariant[] }
export const cloneDraft = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function productDraft(product: AdminProductDetailDTO | undefined, defaultVariant: string, categoryId: string | null = null): ProductDraft {
  return cloneDraft({ name: product?.name ?? '', spuCode: product?.spuCode ?? '', description: product?.description ?? '', translations: product?.translations ?? [], categoryId: product?.categoryId ?? categoryId,
    requiresShipping: product?.requiresShipping !== false, images: product?.images ?? [], isActive: product?.isActive !== false,
    variants: product?.variants?.map(v => ({ ...v, skuCode: v.skuCode ?? '', salePrice: Number(v.salePrice), stock: Number(v.stock), isActive: v.isActive !== false })) ?? [{ name: defaultVariant, salePrice: '', stock: 0, skuCode: '', isActive: true }] });
}
export function duplicateDraft(product: AdminProductDetailDTO, defaultVariant: string): ProductDraft {
  const draft = productDraft(product, defaultVariant); draft.spuCode = ''; draft.isActive = false;
  draft.variants = draft.variants.map(({ id, tempId, hasOrders, ...variant }) => ({ ...variant, skuCode: '' }));
  return draft;
}
export function moveImage(images: string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= images.length || to >= images.length) return images;
  const next = [...images], [image] = next.splice(from, 1); next.splice(to, 0, image); return next;
}
export function applyVariantValues(variants: EditableVariant[], price: string, stock: string): EditableVariant[] {
  return variants.map(variant => ({ ...variant, ...(price !== '' ? { salePrice: Number(price) } : {}), ...(stock !== '' ? { stock: Number(stock) } : {}) }));
}
export const variantFieldId = (variant: EditableVariant, index: number, field: string) => 'variant-' + (variant.id || variant.tempId || index) + '-' + field;
export function productPayload(draft: ProductDraft) {
  return { ...draft, translations: draft.translations.filter(row => row.name.trim()), variants: draft.variants.map(({ tempId, hasOrders, ...variant }) => ({ ...variant, salePrice: Number(variant.salePrice), stock: Number(variant.stock) })) };
}
export function validateProductDraft(draft: ProductDraft, copy: (key: string) => string): Record<string, string> {
  const errors: Record<string, string> = {}, code = /^[A-Za-z0-9._-]{1,64}$/;
  if (!draft.name.trim()) errors['product-name'] = copy('nameRequired');
  if (draft.spuCode.trim() && !code.test(draft.spuCode.trim())) errors['product-spu'] = copy('invalidProductCode');
  const seen = new Map<string, number>();
  draft.variants.forEach((variant, index) => {
    const field = (name: string) => variantFieldId(variant, index, name);
    if (!variant.name.trim()) errors[field('name')] = copy('variantNameRequired');
    if (variant.salePrice === '' || !Number.isFinite(Number(variant.salePrice)) || Number(variant.salePrice) < 0) errors[field('price')] = copy('validPrice');
    if (variant.stock === '' || !Number.isInteger(Number(variant.stock)) || Number(variant.stock) < 0) errors[field('stock')] = copy('validStock');
    const sku = variant.skuCode?.trim() ?? '';
    if (sku && !code.test(sku)) errors[field('sku')] = copy('invalidProductCode');
    if (sku && seen.has(sku.toLowerCase())) { errors[field('sku')] = copy('duplicateSku'); errors[variantFieldId(draft.variants[seen.get(sku.toLowerCase())!], seen.get(sku.toLowerCase())!, 'sku')] = copy('duplicateSku'); }
    if (sku) seen.set(sku.toLowerCase(), index);
  });
  return errors;
}

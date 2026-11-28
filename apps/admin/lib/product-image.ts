type Picture = string | { url?: string } | null;

/** The product's first picture, in whichever shape the core sends it; null when it has none. */
export function getProductImage(product: { images?: Picture[] | null }): string | null {
  const firstImage = Array.isArray(product.images) ? product.images[0] : null;
  if (typeof firstImage === 'string' && firstImage.trim()) return firstImage
  if (firstImage && typeof firstImage === 'object' && 'url' in firstImage && typeof firstImage.url === 'string') {
    return firstImage.url
  }
  return null
}

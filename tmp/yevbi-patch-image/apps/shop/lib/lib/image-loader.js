/**
 * Custom Next.js image loader for CDN integration
 * This loader is used when NEXT_PUBLIC_CDN_URL is configured
 * @see https://nextjs.org/docs/app/api-reference/next-config-js/images#loader-configuration
 */

/**
 * Default image loader that uses CDN URL with transformations
 * @param {Object} params - Loader parameters
 * @param {string} params.src - Image source URL
 * @param {number} params.width - Requested width
 * @param {number} params.quality - Requested quality (1-100)
 * @returns {string} Transformed image URL
 */
export default function cdnImageLoader({ src, width, quality }) {
  const cdnBaseUrl = process.env.NEXT_PUBLIC_CDN_URL;

  // If CDN is not configured or src is already a full URL, return as-is
  if (!cdnBaseUrl || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  // Ensure src starts with /
  const normalizedSrc = src.startsWith('/') ? src : `/${src}`;

  // Build CDN URL with image transformations
  const params = [];

  if (width) {
    params.push(`w=${width}`);
  }

  if (quality) {
    params.push(`q=${quality}`);
  }

  // Build the final URL
  const url = `${cdnBaseUrl}${normalizedSrc}`;

  if (params.length > 0) {
    return `${url}?${params.join('&')}`;
  }

  return url;
}

/**
 * HTML Sanitizer for Plugin Theme Extensions
 *
 * Sanitizes HTML from plugin app blocks and embeds before rendering.
 * Uses isomorphic-dompurify for robust XSS prevention when available,
 * with a conservative regex-based fallback.
 */

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'a', 'img',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'u',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'section', 'article', 'header', 'footer', 'nav', 'main',
    'figure', 'figcaption', 'blockquote', 'pre', 'code',
    'form', 'input', 'button', 'select', 'option', 'textarea', 'label',
    'style',
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'style', 'href', 'src', 'alt', 'title',
    'target', 'rel', 'width', 'height', 'type', 'name',
    'value', 'placeholder', 'for', 'data-*',
  ],
  ALLOW_DATA_ATTR: true,
  ADD_TAGS: ['style'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

/**
 * Regex-based fallback sanitizer for when DOMPurify is not available.
 */
function regexSanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

let _domPurify: any = null;
let _domPurifyChecked = false;

function getSanitizeImpl(): (html: string) => string {
  if (!_domPurifyChecked) {
    _domPurifyChecked = true;
    try {
      // Use indirect require to prevent Turbopack/webpack static analysis
      const mod = 'isomorphic-dompurify';
      _domPurify = module && typeof module.require === 'function'
        ? module.require(mod)
        : null;
    } catch {
      _domPurify = null;
    }
  }
  if (_domPurify) {
    return (html: string) => _domPurify.sanitize(html, DOMPURIFY_CONFIG);
  }
  return regexSanitize;
}

/**
 * Sanitize HTML content from plugin extensions
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return getSanitizeImpl()(html);
}

/**
 * Sanitize CSS content from plugin extensions.
 * Removes dangerous patterns like @import, expression(), and data: URIs.
 */
export function sanitizeCSS(css: string): string {
  if (!css) return '';
  return css
    .replace(/@import\b/gi, '/* blocked */')
    .replace(/expression\s*\(/gi, '/* blocked */')
    .replace(/javascript:/gi, '/* blocked */')
    .replace(/url\s*\(\s*["']?\s*data:text\/html/gi, '/* blocked */');
}

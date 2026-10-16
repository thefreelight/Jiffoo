// Uploaded media is served through Core at /uploads, even with private S3 storage.
// Theme assets are also hash-addressed same-origin Core resources.
const localPatterns = [
  { pathname: '/uploads/**', search: '' },
  { pathname: '/api/v1/themes/**', search: '' },
];

function canOptimizeImage(source) {
  return typeof source === 'string' && !/[\\?#\s]/.test(source)
    && !/%|(?:^|\/)\.{1,2}(?:\/|$)/.test(source)
    && (source.startsWith('/uploads/') || source.startsWith('/api/v1/themes/'));
}

module.exports = { localPatterns, canOptimizeImage };

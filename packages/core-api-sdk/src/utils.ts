export function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) return path;
  if (!path) return baseUrl;

  const baseEndsWithSlash = baseUrl.endsWith('/');
  const pathStartsWithSlash = path.startsWith('/');

  if (baseEndsWithSlash && pathStartsWithSlash) return `${baseUrl}${path.slice(1)}`;
  if (!baseEndsWithSlash && !pathStartsWithSlash) return `${baseUrl}/${path}`;
  return `${baseUrl}${path}`;
}

export function isJsonContentType(contentType: string | null) {
  if (!contentType) return false;
  return contentType.includes('application/json') || contentType.includes('+json');
}

export function getRequestId(headers: Headers) {
  return headers.get('x-request-id') ?? headers.get('x-requestid');
}


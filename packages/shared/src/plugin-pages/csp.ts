/** Only dedicated shells may frame the immutable Core plugin asset family. */
export function pluginShellCsp(origin: string) {
  const url = new URL(origin);
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid shell origin');
  return `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-src ${origin}/api/v1/plugin-assets/; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
}

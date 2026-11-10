/** Detect complete PEM material, not parser constants that merely name a format. */
export function containsPrivateKeyMaterial(bytes: Uint8Array): boolean {
  const text = Buffer.from(bytes).toString('utf8').replace(/\\r\\n|\\n|\\r/g, '\n');
  const blocks = /-----BEGIN ((?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY)-----([\s\S]*?)-----END \1-----/g;
  for (const match of text.matchAll(blocks)) {
    // Traditional encrypted PEM can contain these metadata lines before Base64.
    const body = match[2].replace(/^\s*(?:Proc-Type|DEK-Info):[^\n]*\n/gm, '').trim();
    if (!/^[A-Za-z0-9+/=\s]+$/.test(body)) continue;
    const encoded = body.replace(/\s/g, '');
    if (encoded.length < 32 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) continue;
    const decoded = Buffer.from(encoded, 'base64');
    if (decoded.length && decoded.toString('base64') === encoded) return true;
  }
  return false;
}

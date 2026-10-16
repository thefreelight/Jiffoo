import { randomBytes } from 'node:crypto';

export function generateStorageSecret(byteSource = randomBytes) {
  return 's' + byteSource(48).toString('base64url');
}

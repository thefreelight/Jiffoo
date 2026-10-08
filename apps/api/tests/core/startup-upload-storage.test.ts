import { expect, it } from 'vitest';
import { startThemeChild } from '../helpers/theme-package-fixture';

for (const role of ['startup-api', 'worker']) {
  it(`F ${role} fails fast for an absent real S3 bucket`, async () => {
    await expect(startThemeChild(role, undefined, { UPLOAD_S3_BUCKET: 'b5-bucket-that-does-not-exist' }))
      .rejects.toThrow('Upload storage is temporarily unavailable');
  }, 60000);
  it(`F ${role} fails fast when real S3 rejects explicit credentials`, async () => {
    await expect(startThemeChild(role, undefined, { UPLOAD_S3_ACCESS_KEY_ID: 'invalid-b5-key', UPLOAD_S3_SECRET_ACCESS_KEY: 'invalid-b5-secret' }))
      .rejects.toThrow('Upload storage is temporarily unavailable');
  }, 60000);
}
it('F production refuses local storage and missing S3 configuration without an override', async () => {
  await expect(startThemeChild('startup-api', undefined, { NODE_ENV: 'production', UPLOAD_STORAGE_BACKEND: 'local' }))
    .rejects.toThrow('Production requires s3 upload storage');
  for (const key of ['UPLOAD_S3_ENDPOINT', 'UPLOAD_S3_REGION', 'UPLOAD_S3_BUCKET', 'UPLOAD_S3_ACCESS_KEY_ID', 'UPLOAD_S3_SECRET_ACCESS_KEY']) {
    await expect(startThemeChild('worker', undefined, { [key]: '' })).rejects.toThrow(key);
  }
}, 60000);

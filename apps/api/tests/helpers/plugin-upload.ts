import { previewPluginUpload } from '@/core/admin/extension-installer/plugin-upload';

export async function localUploadOptions(bytes: Buffer, actorUserId: string, confirmUnsigned = true) {
  const preview = await previewPluginUpload(bytes, actorUserId);
  return { actorUserId, previewToken: preview.previewToken, confirmUnsigned, confirmationSlug: confirmUnsigned ? preview.package.slug : undefined };
}

export async function uploadPluginZip(base: string, token: string, bytes: Buffer, confirmUnsigned = true) {
  const authorization = { authorization: `Bearer ${token}` };
  const previewForm = new FormData();
  previewForm.set('file', new Blob([bytes], { type: 'application/zip' }), 'plugin.zip');
  const response = await fetch(`${base}/api/v1/extensions/plugin/preview`, { method: 'POST', headers: authorization, body: previewForm });
  if (!response.ok) return response;
  const preview = (await response.json()).data;
  const form = new FormData();
  form.set('previewToken', preview.previewToken);
  if (confirmUnsigned) { form.set('confirmUnsigned', 'true'); form.set('confirmationSlug', preview.package.slug); }
  form.set('file', new Blob([bytes], { type: 'application/zip' }), 'plugin.zip');
  return fetch(`${base}/api/v1/extensions/plugin/install`, { method: 'POST', headers: authorization, body: form });
}

import { previewPluginUpload } from '@/core/admin/extension-installer/plugin-upload';
import assert from 'node:assert/strict';

export async function localUploadOptions(bytes: Buffer, actorUserId: string, confirmUnsigned = true) {
  const preview = await previewPluginUpload(bytes, actorUserId);
  return { actorUserId, previewToken: preview.previewToken, confirmUnsigned, confirmMigrations: preview.migrationPlan.changesDatabase, confirmationSlug: confirmUnsigned ? preview.package.slug : undefined };
}

export async function waitForPluginUpload(base: string, token: string, accepted: Response, expectedPhase = 'SUCCESS'): Promise<Response> {
  if (!accepted.ok) return accepted;
  assert.equal(accepted.status, 202, 'Installation must accept a durable operation with HTTP 202');
  const { data } = await accepted.json();
  assert.equal(typeof data.operationId, 'string');
  const deadline = Date.now() + 25_000;
  let cursor = '';
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/v1/extensions/plugin/operations/${data.operationId}?wait=true${cursor}`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    const state = (await response.clone().json()).data;
    assert.equal(state.operationId, data.operationId);
    if (!state.terminal) { cursor = `&phase=${encodeURIComponent(state.phase)}&committedPrefix=${state.committedPrefix}`; continue; }
    assert.equal(state.phase, expectedPhase);
    if (expectedPhase === 'SUCCESS') {
      assert.ok(state.result);
      assert.equal(state.result.slug, state.slug); assert.equal(state.result.version, state.version);
      assert.equal(state.result.kind, 'plugin'); assert.ok(Array.isArray(state.result.warnings));
    }
    return response;
  }
  throw new Error('Plugin operation did not reach the expected terminal state');
}

/** Project the real status response's complete install result for existing result assertions. */
export async function completedPluginUploadBody(response: Response) {
  const body = await response.json();
  return response.ok ? { ...body, data: body.data.result, operation: body.data } : body;
}

export async function uploadPluginZip(base: string, token: string, bytes: Buffer, confirmUnsigned = true, expectedPhase = 'SUCCESS') {
  const authorization = { authorization: `Bearer ${token}` };
  const previewForm = new FormData();
  previewForm.set('file', new Blob([bytes], { type: 'application/zip' }), 'plugin.zip');
  const response = await fetch(`${base}/api/v1/extensions/plugin/preview`, { method: 'POST', headers: authorization, body: previewForm });
  if (!response.ok) return response;
  const preview = (await response.json()).data;
  const form = new FormData();
  form.set('previewToken', preview.previewToken);
  if (preview.migrationPlan.changesDatabase) form.set('confirmMigrations', 'true');
  if (confirmUnsigned) { form.set('confirmUnsigned', 'true'); form.set('confirmationSlug', preview.package.slug); }
  form.set('file', new Blob([bytes], { type: 'application/zip' }), 'plugin.zip');
  return waitForPluginUpload(base, token, await fetch(`${base}/api/v1/extensions/plugin/install`, { method: 'POST', headers: authorization, body: form }), expectedPhase);
}

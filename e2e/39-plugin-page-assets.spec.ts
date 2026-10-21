import { expect, test } from './local-requests';
import { createHash } from 'node:crypto';
import { pluginPagePackage } from './plugin-page-package';
import { finalOwnerPassword, login, ownerEmail } from './helpers';

for (const surface of ['shop', 'admin'] as const) test(`${surface}: Vite modules, dynamic imports, rendered WOFF2 and forms work in the opaque asset frame`, async ({ page, request }) => {
  const slug = `e2e-page-assets-${surface}`;
  const api = 'http://127.0.0.1:3001/api/v1';
  const fixture = await pluginPagePackage(slug);
  let installed = false;
  let authorization = '';
  try {
    await login(page, ownerEmail, finalOwnerPassword);
    const authenticated = await request.post(`${api}/auth/login`, { data: { email: ownerEmail, password: finalOwnerPassword, surface: 'admin' } });
    expect(authenticated.ok()).toBe(true);
    authorization = `Bearer ${(await authenticated.json()).data.access_token}`;
    const file = { name: 'page-proof.zip', mimeType: 'application/zip', buffer: fixture.bytes };
    const preview = await request.post(`${api}/extensions/plugin/preview`, { headers: { authorization }, multipart: { file } });
    expect(preview.ok(), await preview.text()).toBe(true);
    const upload = await request.post(`${api}/extensions/plugin/install`, { headers: { authorization }, multipart: {
      previewToken: (await preview.json()).data.previewToken, confirmMigrations: 'true', confirmationSlug: slug, file,
    } });
    expect(upload.status(), await upload.text()).toBe(202);
    const operationId = (await upload.json()).data.operationId;
    let state, cursor = '';
    do {
      const response = await request.get(`${api}/extensions/plugin/operations/${operationId}?wait=true${cursor}`, { headers: { authorization } });
      expect(response.ok()).toBe(true);
      state = (await response.json()).data;
      cursor = `&phase=${encodeURIComponent(state.phase)}&committedPrefix=${state.committedPrefix}`;
    } while (!state.terminal);
    expect(state.phase).toBe('SUCCESS'); installed = true;
    await page.goto(`/en/plugins/${slug}`);
    await page.getByRole('button', { name: 'Enable', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
    const forbiddenSubmissions: string[] = [];
    page.on('request', outgoing => { if (new URL(outgoing.url()).pathname === '/must-not-submit') forbiddenSubmissions.push(outgoing.url()); });
    const hash = createHash('sha256').update(fixture.bytes).digest('hex');
    const origin = surface === 'shop' ? 'http://127.0.0.1:3003' : 'http://127.0.0.1:3002';
    await page.goto(`${origin}/api/v1/extensions/plugin/${slug}/api/proof-host?hash=${hash}&surface=${surface}`);
    const frame = page.getByRole('document', { name: 'Plugin asset proof', exact: true }).contentFrame();
    await expect(frame.getByRole('heading', { name: 'Vite module rendered', exact: true })).toBeVisible();
    await expect(frame.getByText('Dynamic import rendered', { exact: true })).toBeVisible();
    await expect(frame.getByText('Bundled font rendered', { exact: true })).toBeVisible();
    await expect(frame.getByText('Bundled font rendered', { exact: true })).toHaveCSS('font-family', /P2 Outfit/);
    await expect(frame.getByText('Opaque origin verified', { exact: true })).toBeVisible();
    const gatewayUrl = `${api}/extensions/plugin/${slug}/api`;
    const executions = async () => {
      const response = await request.get(`${gatewayUrl}/proof-executions`, { headers: { authorization } });
      expect(response.ok()).toBe(true);
      return response.json();
    };
    expect(await executions()).toEqual({ executions: 0 });
    const rejections = ['missing', 'plugin-page'].map(credential => page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === `/api/v1/extensions/plugin/${slug}/api/check`
        && url.searchParams.get('credential') === credential && response.request().method() === 'POST';
    }));
    await frame.getByRole('button', { name: 'Run React submit handler', exact: true }).click();
    const responses = await Promise.all(rejections);
    for (const [index, response] of responses.entries()) {
      expect(response.status()).toBe(401);
      const headers = await response.request().allHeaders();
      expect(headers.origin).toBe('null');
      expect(headers.cookie).toBeUndefined();
      if (index === 0) expect(headers.authorization).toBeUndefined();
      else expect(headers.authorization).toMatch(/^Bearer /);
    }
    // The frame reads both rejection bodies itself and renders what the server actually sent.
    const rejectionBody = /^401 INVALID_TOKEN \{"success":false,"error":\{"code":"INVALID_TOKEN","message":"[^"]+"\}\}$/;
    await expect(frame.getByRole('status', { name: 'Gateway credential missing' })).toHaveText(rejectionBody);
    await expect(frame.getByRole('status', { name: 'Gateway credential plugin-page' })).toHaveText(rejectionBody);
    await expect(frame.getByRole('status', { name: 'Gateway proof' })).toHaveText('Gateway attempts finished');
    expect(await executions()).toEqual({ executions: 0 });
    // A Core-authenticated positive control proves the fixture counter observes real execution.
    const control = await request.post(`${gatewayUrl}/check`, { headers: { authorization } });
    expect(control.ok()).toBe(true);
    expect(await control.json()).toEqual({ executed: true, executions: 1 });
    expect(await executions()).toEqual({ executions: 1 });
    await frame.getByRole('button', { name: 'Attempt real submission', exact: true }).click();
    await expect(frame.getByRole('status', { name: 'Submission proof' })).toHaveText('Real submission blocked');
    await expect(frame.getByRole('heading', { name: 'Vite module rendered', exact: true })).toBeVisible();
    expect(forbiddenSubmissions).toEqual([]);
  } finally {
    if (installed) {
      expect((await request.delete(`${api}/extensions/plugin/${slug}`, { headers: { authorization } })).ok()).toBe(true);
      expect((await request.delete(`${api}/extensions/plugin/${slug}/purge`, { headers: { authorization }, data: { confirmationSlug: slug } })).ok()).toBe(true);
    }
    await fixture.cleanup();
  }
});

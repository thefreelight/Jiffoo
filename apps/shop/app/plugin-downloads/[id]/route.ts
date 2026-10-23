import { proxyPrivateDownload } from 'shared/src/plugin-pages/download-proxy';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return proxyPrivateDownload(request, (await context.params).id, process.env.API_SERVICE_URL);
}
export const HEAD = GET;

// Static APK download endpoint for the website distribution channel.
// Serves R2 objects under bokmoo.com/downloads/* with store-appropriate
// headers; the update reminder's apkUrl points here.

interface DownloadsEnv {
  DOWNLOADS: R2Bucket;
  RUNTIME_VERSION?: string;
}

const CONTENT_TYPES: Record<string, string> = {
  apk: 'application/vnd.android.package-archive',
  ipa: 'application/vnd.apple.ios',
  // iOS OTA requires the manifest served as XML — wrong MIME aborts install.
  plist: 'text/xml',
  html: 'text/html; charset=utf-8',
};

export default {
  async fetch(request: Request, env: DownloadsEnv): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.replace(/^\/downloads\//, '').replace(/\/+$/, '');
    if (!key || key.includes('..')) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const object = await env.DOWNLOADS.get(key);
    if (!object) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    const headers = new Headers({
      'content-type': CONTENT_TYPES[ext] ?? object.httpMetadata?.contentType ?? 'application/octet-stream',
      ...(key.endsWith('.plist') || key.endsWith('.html')
        ? {}
        : { 'content-disposition': `attachment; filename="${key}"` }),
      'cache-control': 'public, max-age=300',
      'x-jiffoo-runtime': 'cloudflare-native-downloads',
      'x-content-version': env.RUNTIME_VERSION ?? 'dev',
    });
    const body = request.method === 'HEAD' ? null : object.body;
    return new Response(body, { status: 200, headers });
  },
};

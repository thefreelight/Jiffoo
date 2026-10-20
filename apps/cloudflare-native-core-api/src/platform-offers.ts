/**
 * Native platform offers read. The commercial offers feed has no
 * Cloudflare-native store; answering with an explicit empty payload keeps
 * dashboard renders instant instead of falling through to the
 * self-referential CORE_ORIGIN proxy (which surfaces as 522 timeouts).
 */
export async function tryNativePlatformOffers(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/platform-offers' || request.method !== 'GET') return null;
  return Response.json(
    { success: true, data: { offers: [] } },
    { status: 200, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-platform-offers' } },
  );
}

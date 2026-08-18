type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

const BUILD_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function addBuildProvenance(
  request: Request,
  response: Response,
  assets: AssetsBinding,
): Promise<Response> {
  try {
    const buildIdUrl = new URL('/BUILD_ID', request.url);
    const buildIdResponse = await assets.fetch(new Request(buildIdUrl));
    if (!buildIdResponse.ok) return response;

    const buildId = (await buildIdResponse.text()).trim();
    if (!BUILD_ID_PATTERN.test(buildId)) return response;

    const headers = new Headers(response.headers);
    headers.set('x-jiffoo-build-id', buildId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

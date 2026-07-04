import {
  PUBLIC_CORE_UPDATE_MANIFEST,
} from 'shared/src/core-update/public-manifest';

export async function GET() {
  return Response.json(PUBLIC_CORE_UPDATE_MANIFEST, {
    headers: {
      'cache-control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}

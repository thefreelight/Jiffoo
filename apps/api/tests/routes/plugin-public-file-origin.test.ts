import Fastify from 'fastify';
import { expect, it } from 'vitest';
import { registerOriginPolicy } from '@/core/plugin-pages/origin-policy';

it('admits only exact guest public-file GET/HEAD through the opaque origin policy', async () => {
  const app = Fastify();
  await registerOriginPolicy(app, { enabled: true, origin: [], credentials: false });
  const path = '/api/v1/plugin-public-files/12345678-1234-4123-8123-123456789abc';
  app.route({ method: ['GET', 'HEAD', 'POST'], url: path, handler: async (_request, reply) => reply.type('image/png').send(Buffer.from([137, 80, 78, 71])) });
  try {
    for (const method of ['GET', 'HEAD'] as const) {
      const response = await app.inject({ method, url: `${path}?token=signed`, headers: { origin: 'null' } });
      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('null');
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    }
    expect((await app.inject({ method: 'POST', url: path, headers: { origin: 'null' } })).statusCode).toBe(403);
    expect((await app.inject({ url: `${path}/extra?token=signed`, headers: { origin: 'null' } })).statusCode).toBe(403);
  } finally { await app.close(); }
});

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { withClientIp } from '../server.mjs';

const servers: Array<ReturnType<typeof createServer>> = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()))));
});

it('G strips spoofed forwarding headers before the Next handler sees a request', async () => {
  const server = createServer(withClientIp((req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      forwardedFor: req.headers['x-forwarded-for'],
      forwarded: req.headers.forwarded,
      realIp: req.headers['x-real-ip'],
      peer: req.socket.remoteAddress,
    }));
  }, []));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test listener');
  const response = await fetch(`http://127.0.0.1:${address.port}`, {
    headers: {
      'x-forwarded-for': '198.51.100.8',
      forwarded: 'for=198.51.100.8',
      'x-real-ip': '198.51.100.8',
    },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ forwardedFor: '127.0.0.1', peer: '127.0.0.1' });
});

import { createServer, connect, type Socket } from 'node:net';
import { once } from 'node:events';

export async function redisRelay(originalUrl: string) {
  const original = new URL(originalUrl);
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    const upstream = connect({ host: original.hostname, port: Number(original.port || 6379) });
    for (const value of [socket, upstream]) {
      sockets.add(value);
      value.on('close', () => sockets.delete(value));
      value.on('error', () => { socket.destroy(); upstream.destroy(); });
    }
    socket.pipe(upstream); upstream.pipe(socket);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing relay address');
  const port = address.port;
  const target = new URL(original); target.hostname = '127.0.0.1'; target.port = String(port);
  const drop = async () => {
    if (!server.listening) return;
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const socket of sockets) socket.destroy();
    await closed;
  };
  const recover = async (expectedConnections: number) => {
    const connected = new Promise<void>((resolve) => {
      let count = 0;
      const accepted = () => { if (++count === expectedConnections) { server.off('connection', accepted); resolve(); } };
      server.on('connection', accepted);
    });
    server.listen(port, '127.0.0.1'); await once(server, 'listening');
    await connected;
  };
  return { url: target.href, drop, recover };
}

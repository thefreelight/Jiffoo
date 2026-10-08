import { connect, createServer, type Socket } from 'node:net';
import { once } from 'node:events';

/** Forward real PostgreSQL protocol bytes and lose one successful COMMIT acknowledgement. */
export async function commitAcknowledgementProxy(databaseUrl: string) {
  const target = new URL(databaseUrl);
  const upstreamHost = target.hostname;
  const upstreamPort = Number(target.port || 5432);
  const sockets = new Set<Socket>();
  let lost!: (operationId: string) => void;
  const acknowledged = new Promise<string>(resolve => { lost = resolve; });
  let dropped = false;
  const server = createServer(client => {
    const upstream = connect({ host: upstreamHost, port: upstreamPort });
    sockets.add(client); sockets.add(upstream);
    let startup = false, rawTls = false, requestedSsl = false, applicationName = '', committing = false;
    let front = Buffer.alloc(0), back = Buffer.alloc(0);
    let command = '', held: Buffer[] = [];
    client.on('data', chunk => {
      // Observing protocol boundaries must never delay the real request stream.
      upstream.write(chunk);
      if (rawTls || startup && !applicationName.startsWith('jiffoo-plugin-migration:')) return;
      front = Buffer.concat([front, chunk]);
      while (front.length >= (startup ? 5 : 4)) {
        const length = startup ? front.readUInt32BE(1) + 1 : front.readUInt32BE(0);
        if (front.length < length) return;
        const packet = front.subarray(0, length); front = front.subarray(length);
        if (!startup) {
          if (length === 8 && [80877103, 80877104].includes(packet.readUInt32BE(4))) requestedSsl = true;
          else {
            const fields = packet.subarray(8).toString('utf8').split('\0');
            for (let index = 0; index < fields.length - 1; index += 2) if (fields[index] === 'application_name') applicationName = fields[index + 1];
            startup = true;
          }
        } else if (packet[0] === 81 && packet.subarray(5).toString('utf8') === 'COMMIT\0'
          && applicationName.startsWith('jiffoo-plugin-migration:') && !dropped) {
          committing = true;
        }
      }
    });
    upstream.on('data', chunk => {
      if (requestedSsl) {
        requestedSsl = false;
        if (chunk[0] === 83) { rawTls = true; front = Buffer.alloc(0); }
        client.write(chunk); return;
      }
      if (!committing) { client.write(chunk); return; }
      back = Buffer.concat([back, chunk]);
      while (back.length >= 5) {
        const length = back.readUInt32BE(1) + 1;
        if (back.length < length) return;
        const packet = back.subarray(0, length); back = back.subarray(length); held.push(packet);
        if (packet[0] === 67) command = packet.subarray(5).toString('utf8');
        if (packet[0] !== 90) continue;
        if (command === 'COMMIT\0' && packet[5] === 73) {
          dropped = true; committing = false;
          lost(applicationName.slice('jiffoo-plugin-migration:'.length));
          // The server has committed; the client sees a real disconnected TCP connection.
          client.destroy(); upstream.end(); return;
        }
        for (const buffered of held) client.write(buffered);
        held = []; committing = false;
      }
    });
    client.on('error', () => upstream.end()); upstream.on('error', () => client.destroy());
    client.on('close', () => { sockets.delete(client); upstream.end(); });
    upstream.on('close', () => { sockets.delete(upstream); client.end(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Proxy did not get a TCP port');
  target.hostname = '127.0.0.1'; target.port = String(address.port);
  return { databaseUrl: target.toString(), acknowledged, close: async () => {
    for (const socket of sockets) socket.end();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}

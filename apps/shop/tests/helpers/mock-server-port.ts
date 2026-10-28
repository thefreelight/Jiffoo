import type { Server } from 'node:http';

/**
 * The ports that the request of Node refuses.
 *
 * The specification blocks a list of ports for the request of a browser and
 * the request of Node refuses them as well. The operating system hands out
 * the ports of its dynamic range, and that range reaches the blocked ports,
 * so a mock that listens on an ephemeral port is refused by the request once
 * in a while.
 */
const BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95,
  101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 127, 129, 135, 137, 139, 143,
  161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556,
  563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190,
  5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080,
]);

/** The number of ports a mock may try before it gives up. */
const LISTEN_ATTEMPTS = 5;

/**
 * Listen on a port that the request of Node can carry.
 *
 * The mock of a test binds an ephemeral port, and the operating system may
 * hand out one of the blocked ports, which the request refuses with a "bad
 * port" error. The mock then listens again and takes the next port.
 *
 * @param server The server that listens
 * @param host The host the server listens on
 * @returns The port the server listens on
 */
export async function listenOnUsablePort(server: Server, host = '127.0.0.1'): Promise<number> {
  for (let attempt = 0; attempt < LISTEN_ATTEMPTS; attempt += 1) {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, host, () => { server.off('error', reject); resolve(); });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('The mock server did not get a TCP port');
    if (!BLOCKED_PORTS.has(address.port)) return address.port;
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
  }
  throw new Error('The mock server did not get a usable TCP port');
}

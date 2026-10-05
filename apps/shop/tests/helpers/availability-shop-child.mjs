import next from 'next';
import { createServer } from 'node:http';
import { withClientIp } from '../../server.mjs';

let handler;
const server = createServer(withClientIp((request, response) => handler(request, response), []));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
process.env.STOREFRONT_URL = `http://127.0.0.1:${server.address().port}`;
const app = next({ dev: false, dir: process.cwd(), hostname: '127.0.0.1' });
await app.prepare();
handler = app.getRequestHandler();
process.send({ port: server.address().port });
process.once('message', async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await app.close();
  console.info(`Shop fixture closed; remaining runtime resources: ${process.getActiveResourcesInfo().join(', ')}`);
  process.disconnect();
  // The test process owns this server and exits only after closing its resources.
  process.exit(0);
});

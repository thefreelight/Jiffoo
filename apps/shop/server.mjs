import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import next from 'next';
import trustedProxyUtils from 'shared/trusted-proxies';
import { resolveProviderLibraryOverrides } from './lib/provider-library-overrides.mjs';

const { clientIp, parseTrustedProxies } = trustedProxyUtils;

export function withClientIp(handler, trusted) {
  return (req, res) => {
    const peer = req.socket.remoteAddress;
    if (!peer) throw new Error('Client connection has no remote address');
    const ip = clientIp(peer, req.headers['x-forwarded-for'], trusted);
    delete req.headers['x-forwarded-for'];
    delete req.headers.forwarded;
    delete req.headers['x-real-ip'];
    req.headers['x-forwarded-for'] = ip;
    return handler(req, res);
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  resolveProviderLibraryOverrides(process.env.STOREFRONT_PROVIDER_LIBRARY_OVERRIDES, process.env.STOREFRONT_URL);
  const trusted = parseTrustedProxies(process.env.TRUSTED_PROXIES);
  console.info(`TRUSTED_PROXIES: ${trusted.join(', ') || '(none)'}`);
  const hostname = process.env.HOSTNAME || '0.0.0.0';
  const port = Number(process.env.PORT || 3003);
  const app = next({ dev: false, dir: fileURLToPath(new URL('.', import.meta.url)), hostname, port });
  await app.prepare();
  const server = createServer(withClientIp(app.getRequestHandler(), trusted));
  server.listen(port, hostname, () => console.info(`Shop listening on ${hostname}:${port}`));
}

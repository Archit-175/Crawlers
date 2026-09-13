import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import next from 'next';
import { pathToFileURL } from 'node:url';

/** Next owns all page rendering, API route handlers and static files. This small
 * Node host adds a trusted socket address and orderly shutdown for persistent jobs. */
/** @param {{dev?: boolean, port?: number, hostname?: string}} [options] */
export async function startServer({ dev = false, port, hostname } = {}) {
  if (existsSync('.env')) loadEnvFile('.env');
  process.env.NODE_ENV = dev ? 'development' : 'production';
  port ??= Number(process.env.PORT ?? 3001);
  hostname ??= process.env.HOST ?? '127.0.0.1';
  globalThis.__crawlersTransportToken = randomBytes(32).toString('hex');
  const app = next({ dev, port, hostname });
  await app.prepare();
  const handle = app.getRequestHandler();
  const server = createServer((req, res) => {
    req.headers['x-crawlers-peer'] = req.socket.remoteAddress ?? 'unknown';
    req.headers['x-crawlers-transport'] = globalThis.__crawlersTransportToken;
    void handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end('Request failed');
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.on('upgrade', app.getUpgradeHandler());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, hostname, resolve);
  });
  console.log(`Crawlers · Next.js · http://${hostname}:${port}`);
  let closing;
  const close = () =>
    (closing ??= (async () => {
      const httpClosed = new Promise((resolve) => server.close(resolve));
      await globalThis.__crawlersRuntime?.shutdown();
      server.closeIdleConnections();
      await app.close();
      server.closeAllConnections();
      await httpClosed;
    })());
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void close().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    });
  return { server, close };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer({ dev: process.argv.includes('--dev') });
}

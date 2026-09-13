import { createRuntime } from '../server/runtime';
import { startServer } from '../scripts/start.mjs';
import { Store } from '../server/store';
import { Engine } from '../server/crawler/engine';
import { readConfig } from '../server/config';
import { resolvePublicUrl } from '../server/crawler/security';
import { fixtures, fixtureHost } from './fixtures';
const store = new Store(':memory:');
const engine = new Engine(store, fixtures({ latency: 300 }).fetcher);
const config = readConfig({
  NODE_ENV: 'test',
  PORT: '3002',
  APP_ORIGIN: 'http://localhost:3002',
  CRAWL_API_KEY: 'e2e-fixture-key-only-never-for-production',
});
const runtime = createRuntime({
  config,
  store,
  engine,
  validateTarget: async (url) =>
    new URL(url).origin === fixtureHost
      ? { url: new URL(url), address: '1.1.1.1', family: 4 }
      : resolvePublicUrl(url),
});
(
  globalThis as typeof globalThis & { __crawlersRuntime?: ReturnType<typeof createRuntime> }
).__crawlersRuntime = runtime;
await startServer({ port: 3002, hostname: '127.0.0.1' });

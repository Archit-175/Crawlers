import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { startServer } from './start.mjs';

// Exercise the real Next host and database without touching workspace data.
const temporary = mkdtempSync(join(tmpdir(), 'crawlers-next-'));
const dev = process.argv.includes('--dev');
const port = 3003;
process.env.PORT = String(port);
process.env.HOST = '127.0.0.1';
process.env.APP_ORIGIN = `http://localhost:${port}`;
process.env.DATABASE_PATH = join(temporary, 'workspace.sqlite');
process.env.CRAWL_API_KEY = randomBytes(32).toString('hex');
process.env.LOG_LEVEL = 'silent';
const { close } = await startServer({ dev, port, hostname: '127.0.0.1' });
try {
  const origin = process.env.APP_ORIGIN;
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).framework, 'nextjs');
  assert(existsSync(process.env.DATABASE_PATH));
  assert.equal((await fetch(`${origin}/api/jobs`)).status, 401);
  for (const path of ['/forests', '/forests/corbett', '/quiz', '/gallery', '/legacy/index.html']) {
    assert.equal((await fetch(`${origin}${path}`)).status, 200, path);
  }
  const stream = await fetch(`${origin}/api/events`, {
    headers: { authorization: `Bearer ${process.env.CRAWL_API_KEY}` },
  });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: update/);
  const started = Date.now();
  await close();
  // Queued heartbeat bytes may arrive before the stream's close marker.
  while (!(await reader.read()).done) {
    /* Drain the connection. */
  }
  assert(Date.now() - started < 10000, 'Shutdown exceeded ten seconds');
  assert(globalThis.__crawlersRuntime.closing);
  console.log(
    `Next.js ${dev ? 'development' : 'production'} smoke passed: pages, auth, SQLite, SSE and graceful shutdown.`,
  );
} finally {
  await close();
  const target = resolve(temporary);
  assert(target.startsWith(resolve(tmpdir()) + sep) && target.includes('crawlers-next-'));
  rmSync(target, { recursive: true, force: true });
}
// Match the CLI's signal lifecycle after durable shutdown. Next dev compilation
// can retain background handles even after its public close() API resolves.
process.exit(0);

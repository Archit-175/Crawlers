import { Store } from '../server/store';
import { Engine } from '../server/crawler/engine';
import { crawlConfigSchema } from '../shared/types';
import { setTimeout as delay } from 'node:timers/promises';
const store = new Store(':memory:');
const engine = new Engine(store);
try {
  const job = store.create(
    crawlConfigSchema.parse({
      url: process.argv[2] ?? 'https://example.com',
      maxPages: 1,
      maxDepth: 0,
      timeoutMs: 10000,
      retries: 0,
    }),
  );
  engine.kick();
  const deadline = Date.now() + 35000;
  while (['queued', 'running'].includes(store.job(job.id)!.status) && Date.now() < deadline)
    await delay(100);
  const result = store.job(job.id)!;
  console.log(
    JSON.stringify(
      {
        target: result.url,
        status: result.status,
        crawled: result.crawled,
        failed: result.failed,
        error: result.error,
        pages: store.pages(job.id).items.map((page) => ({
          status: page.status,
          http: page.statusCode,
          title: page.title,
          error: page.error,
        })),
      },
      null,
      2,
    ),
  );
  if (result.status !== 'completed' || result.crawled !== 1) process.exitCode = 1;
} finally {
  await engine.shutdown();
  store.close();
}

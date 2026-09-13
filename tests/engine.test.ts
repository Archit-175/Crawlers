import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../server/store';
import { Engine } from '../server/crawler/engine';
import { crawlConfigSchema } from '../shared/types';
import { fixtures, fixtureHost, until } from './fixtures';
const config = (overrides: Record<string, unknown> = {}) =>
  crawlConfigSchema.parse({ url: fixtureHost, delayMs: 200, maxDepth: 1, ...overrides });
test('durable crawler enforces deduplication, depth, host, robots, retries, failures and extraction', async () => {
  const store = new Store(':memory:');
  const fixture = fixtures();
  const engine = new Engine(store, fixture.fetcher);
  const job = store.create(config());
  try {
    engine.kick();
    await until(() => store.job(job.id)?.status === 'completed');
    const pages = store.pages(job.id, { limit: 100 }).items;
    assert.equal(pages.filter((p) => p.url === `${fixtureHost}/a`).length, 1);
    assert(!pages.some((p) => p.url.endsWith('/deeper')));
    assert(!fixture.calls.some((url) => url.includes('elsewhere')));
    assert(!fixture.calls.some((url) => url.endsWith('/private')));
    assert.equal(pages.find((p) => p.url.endsWith('/private'))?.status, 'blocked');
    assert.equal(pages.find((p) => p.url.endsWith('/broken'))?.statusCode, 404);
    assert.equal(pages.find((p) => p.url.endsWith('/retry'))?.attempts, 2);
    assert.equal(pages.find((p) => p.url.endsWith('/document'))?.status, 'skipped');
    assert.equal(pages.find((p) => p.url.endsWith('/empty'))?.wordCount, 0);
    assert.equal(store.job(job.id)?.crawled, 5);
    assert.equal(store.page(job.id, pages[0].id)?.data?.title, 'Forest research');
  } finally {
    await engine.shutdown();
    store.close();
  }
});
test('page limit and depth zero are strict even with sitemaps', async () => {
  const store = new Store(':memory:');
  const fixture = fixtures();
  const engine = new Engine(store, fixture.fetcher);
  try {
    const job = store.create(config({ maxPages: 1, maxDepth: 0, useSitemap: true }));
    engine.kick();
    await until(() => store.job(job.id)?.status === 'completed');
    assert.equal(store.job(job.id)?.discovered, 1);
    assert(!fixture.calls.some((url) => url.endsWith('.xml')));
  } finally {
    await engine.shutdown();
    store.close();
  }
});
test('bounded sitemap index discovers same-host pages', async () => {
  const store = new Store(':memory:');
  const fixture = fixtures();
  const engine = new Engine(store, fixture.fetcher);
  try {
    const job = store.create(config({ maxPages: 3, useSitemap: true }));
    engine.kick();
    await until(() => store.job(job.id)?.status === 'completed');
    assert(store.pages(job.id).items.some((p) => p.url.endsWith('/sitemap-only')));
    assert.equal(store.job(job.id)?.discovered, 3);
  } finally {
    await engine.shutdown();
    store.close();
  }
});
test('unavailable robots stops the job conservatively', async () => {
  const store = new Store(':memory:');
  const fixture = fixtures({ failRobots: true });
  const engine = new Engine(store, fixture.fetcher);
  try {
    const job = store.create(config());
    engine.kick();
    await until(() => store.job(job.id)?.status === 'failed');
    assert.equal(fixture.calls.length, 1);
    assert.match(store.job(job.id)?.error ?? '', /ROBOTS_UNAVAILABLE/);
  } finally {
    await engine.shutdown();
    store.close();
  }
});
test('pause, resume, stop and state transition guards', async () => {
  const store = new Store(':memory:');
  const fixture = fixtures({ latency: 300 });
  const engine = new Engine(store, fixture.fetcher);
  try {
    const job = store.create(config());
    engine.kick();
    await until(() => fixture.calls.length >= 2);
    await engine.control(job.id, 'pause');
    assert.equal(store.job(job.id)?.status, 'paused');
    assert.equal(store.pages(job.id).items.filter((p) => p.status === 'fetching').length, 0);
    await engine.control(job.id, 'resume');
    await until(() => store.job(job.id)?.crawled === 1);
    await engine.control(job.id, 'stop');
    assert.equal(store.job(job.id)?.status, 'stopped');
    await assert.rejects(engine.control(job.id, 'resume'), /Cannot/);
  } finally {
    await engine.shutdown();
    store.close();
  }
});
test('request start spacing and concurrency are enforced', async () => {
  const store = new Store(':memory:');
  const fixture = fixtures({ latency: 450 });
  const starts: number[] = [];
  const engine = new Engine(store, async (url, opts) =>
    fixture.fetcher(url, {
      ...opts,
      beforeRequest: async (u) => {
        await opts.beforeRequest?.(u);
        starts.push(Date.now());
      },
    }),
  );
  try {
    const job = store.create(config({ maxPages: 4, concurrency: 2 }));
    engine.kick();
    await until(() => store.job(job.id)?.status === 'completed');
    assert(fixture.maxActive <= 2);
    assert.equal(fixture.maxActive, 2);
    for (let i = 1; i < starts.length; i++) assert(starts[i] - starts[i - 1] >= 180);
  } finally {
    await engine.shutdown();
    store.close();
  }
});
test('restart recovers running jobs and fetching pages without losing data', () => {
  const folder = mkdtempSync(join(tmpdir(), 'crawlers-db-'));
  let store = new Store(join(folder, 'test.sqlite'));
  try {
    const job = store.create(config());
    store.status(job.id, 'running');
    store.claim(job.id);
    store.close();
    store = new Store(join(folder, 'test.sqlite'));
    store.recover();
    assert.equal(store.job(job.id)?.status, 'paused');
    assert.equal(store.pages(job.id).items[0].status, 'queued');
    assert.equal(store.job(job.id)?.discovered, 1);
  } finally {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
test('queue claiming, parameterized search and failed retry preserve successes', () => {
  const store = new Store(':memory:');
  try {
    const job = store.create(config());
    const page = store.claim(job.id)!;
    assert.equal(store.claim(job.id), undefined);
    store.finish(page.id, 'failed', { error: 'NETWORK' });
    store.retry(job.id);
    assert.equal(store.pages(job.id).items[0].status, 'queued');
    assert.equal(store.pages(job.id, { search: "' OR 1=1 --" }).total, 0);
    assert.equal(store.pages(job.id, { search: '%' }).total, 0);
  } finally {
    store.close();
  }
});

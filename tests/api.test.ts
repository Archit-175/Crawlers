import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store';
import { createRuntime, RateLimiter } from '../server/runtime';
import { handleEndpoint, type Endpoint } from '../server/api';
import { Engine } from '../server/crawler/engine';
import { readConfig } from '../server/config';
import { fixtureHost, fixtures, until } from './fixtures';
const key = 'test-workspace-key-never-use-in-production';
test('API authorization, validation, persistence, pagination, exports, controls and isolation', async (t) => {
  const config = readConfig({ NODE_ENV: 'test', CRAWL_API_KEY: key });
  const store = new Store(':memory:');
  const engine = new Engine(store, fixtures().fetcher);
  const runtime = createRuntime({
    config,
    store,
    engine,
    validateTarget: async () => ({ url: new URL(fixtureHost), address: '1.1.1.1', family: 4 }),
  });
  const app = testClient(runtime);
  const headers = { host: 'localhost:3001', authorization: `Bearer ${key}` };
  let id = '';
  try {
    await t.test('unauthenticated API read is rejected', async () =>
      assert.equal(
        (await app.inject({ url: '/api/jobs', headers: { host: 'localhost:3001' } })).statusCode,
        401,
      ),
    );
    await t.test('health is public and database backed', async () =>
      assert.equal(
        (await app.inject({ url: '/api/health', headers: { host: 'localhost:3001' } })).statusCode,
        200,
      ),
    );
    await t.test('host and origin checks prevent rebinding and CSRF', async () => {
      assert.equal(
        (await app.inject({ url: '/api/jobs', headers: { ...headers, host: 'evil.example' } }))
          .statusCode,
        403,
      );
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/jobs',
            headers: { ...headers, origin: 'https://evil.example' },
            payload: { url: fixtureHost },
          })
        ).statusCode,
        403,
      );
    });
    await t.test('session login sets an HttpOnly cookie without returning the key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/session',
        headers: { host: 'localhost:3001' },
        payload: { key },
      });
      assert.equal(response.statusCode, 200);
      assert.match(String(response.headers['set-cookie']), /HttpOnly/);
      assert(!response.body.includes(key));
      assert.equal(
        (
          await app.inject({
            url: '/api/jobs',
            headers: {
              host: 'localhost:3001',
              cookie: String(response.headers['set-cookie']).split(';')[0],
            },
          })
        ).statusCode,
        200,
      );
    });
    await t.test('invalid and excessive crawl settings are rejected', async () => {
      for (const payload of [
        { url: 'not-url' },
        { url: 'file:///etc/passwd' },
        { url: fixtureHost, maxPages: 501 },
        { url: fixtureHost, concurrency: 20 },
        { url: fixtureHost, pathPrefix: '/other' },
        { url: fixtureHost, unknown: true },
      ])
        assert.equal(
          (await app.inject({ method: 'POST', url: '/api/jobs', headers, payload })).statusCode,
          400,
        );
    });
    await t.test('creates and runs a persisted job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        headers,
        payload: { url: fixtureHost, maxPages: 4, delayMs: 200 },
      });
      assert.equal(response.statusCode, 201, response.body);
      id = response.json().id;
      await until(() => store.job(id)?.status === 'completed');
      assert.equal(store.job(id)?.discovered, 4);
    });
    await t.test('pagination, filtering and page inspector return real records', async () => {
      const response = await app.inject({ url: `/api/jobs/${id}/pages?limit=2`, headers });
      assert.equal(response.json().items.length, 2);
      assert.equal(response.json().total, 4);
      const page = response.json().items[0];
      const detail = await app.inject({ url: `/api/jobs/${id}/pages/${page.id}`, headers });
      assert.equal(detail.json().data.title, 'Forest research');
      const filtered = await app.inject({ url: `/api/jobs/${id}/pages?status=blocked`, headers });
      assert.equal(filtered.json().total, 1);
    });
    await t.test('exports CSV and full JSON with download headers', async () => {
      const csv = await app.inject({ url: `/api/jobs/${id}/export?format=csv`, headers });
      assert.match(String(csv.headers['content-disposition']), /attachment/);
      assert.match(csv.body, /Forest research/);
      const json = await app.inject({ url: `/api/jobs/${id}/export?format=json`, headers });
      assert.equal(json.json().pages[0].data.title, 'Forest research');
    });
    await t.test('invalid transitions and missing jobs report correct errors', async () => {
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: `/api/jobs/${id}/control`,
            headers,
            payload: { action: 'pause' },
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (await app.inject({ url: '/api/jobs/00000000-0000-4000-8000-000000000000', headers }))
          .statusCode,
        404,
      );
    });
    await t.test('delete cascades to pages', async () => {
      assert.equal(
        (await app.inject({ method: 'DELETE', url: `/api/jobs/${id}`, headers })).statusCode,
        204,
      );
      assert.equal(store.pages(id).total, 0);
    });
  } finally {
    await engine.shutdown();
    await runtime.shutdown();
    store.close();
  }
});
test('actual API rejects private IP targets before job creation', async () => {
  const config = readConfig({ NODE_ENV: 'test' });
  const store = new Store(':memory:');
  const runtime = createRuntime({ config, store });
  const app = testClient(runtime);
  try {
    const result = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      headers: { host: 'localhost:3001' },
      payload: { url: 'http://169.254.169.254/' },
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.json().code, 'SSRF_BLOCKED');
    assert.equal(store.jobs().length, 0);
  } finally {
    await runtime.shutdown();
    store.close();
  }
});
test('SSE emits real updates, cancels and closes on graceful shutdown', async () => {
  const store = new Store(':memory:');
  const runtime = createRuntime({ config: readConfig({ NODE_ENV: 'test' }), store });
  try {
    const request = new Request('http://localhost:3001/api/events', {
      headers: { host: 'localhost:3001' },
    });
    const response = await handleEndpoint('events', request, {}, runtime);
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body!.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: update/);
    assert.equal(runtime.connections.size, 1);
    runtime.engine.notify();
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: update/);
    await runtime.shutdown();
    assert.equal((await reader.read()).done, true);
    assert.equal(runtime.connections.size, 0);
    assert.equal(runtime.engine.listenerCount('change'), 0);
  } finally {
    await runtime.shutdown();
    store.close();
  }
});

test('JSON parsing enforces a byte limit and content type', async () => {
  const store = new Store(':memory:');
  const runtime = createRuntime({ config: readConfig({ NODE_ENV: 'test' }), store });
  try {
    for (const [contentType, body, status] of [
      ['text/plain', '{}', 415],
      ['application/json', '{', 400],
      ['application/json', JSON.stringify({ url: 'x'.repeat(17000) }), 413],
    ] as const) {
      const response = await handleEndpoint(
        'jobs.create',
        new Request('http://localhost:3001/api/jobs', {
          method: 'POST',
          headers: { host: 'localhost:3001', 'content-type': contentType },
          body,
        }),
        {},
        runtime,
      );
      assert.equal(response.status, status);
    }
  } finally {
    await runtime.shutdown();
    store.close();
  }
});

test('login rate limit cannot be bypassed by spoofing client headers', async () => {
  const store = new Store(':memory:');
  const runtime = createRuntime({
    config: readConfig({ NODE_ENV: 'test', CRAWL_API_KEY: key }),
    store,
  });
  try {
    for (let i = 0; i < 9; i++) {
      const response = await handleEndpoint(
        'session.login',
        new Request('http://localhost:3001/api/session', {
          method: 'POST',
          headers: {
            host: 'localhost:3001',
            'content-type': 'application/json',
            'x-forwarded-for': `8.8.8.${i}`,
            'x-crawlers-peer': `8.8.8.${i}`,
            'x-crawlers-transport': 'forged',
          },
          body: JSON.stringify({ key: 'wrong' }),
        }),
        {},
        runtime,
      );
      assert.equal(response.status, i < 8 ? 401 : 429);
      if (i === 8) assert(Number(response.headers.get('retry-after')) > 0);
    }
  } finally {
    await runtime.shutdown();
    store.close();
  }
});

test('rate limiter expires windows and bounds identities', () => {
  const limiter = new RateLimiter();
  assert.equal(limiter.take('one', 1, 1000, 0), 0);
  assert.equal(limiter.take('one', 1, 1000, 1), 1);
  assert.equal(limiter.take('one', 1, 1000, 1000), 0);
  for (let i = 0; i < 10000; i++) limiter.take(String(i), 1, 10000, 2000);
  assert.equal(limiter.take('overflow', 1, 10000, 2000), 60);
  assert.equal(limiter.take('overflow', 1, 10000, 12000), 0);
});

// Requests exercise the same framework-independent controllers as App Router.
// Real routing, method handling, static isolation and streaming are browser-tested.
function testClient(runtime: ReturnType<typeof createRuntime>) {
  return {
    async inject(input: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      payload?: unknown;
    }) {
      const path = new URL(input.url, 'http://localhost:3001').pathname.split('/').filter(Boolean);
      const method = input.method ?? 'GET';
      let endpoint: Endpoint;
      if (path[1] === 'health') endpoint = 'health';
      else if (path[1] === 'session')
        endpoint = method === 'POST' ? 'session.login' : 'session.get';
      else if (path.length === 2) endpoint = method === 'POST' ? 'jobs.create' : 'jobs.list';
      else if (path[3] === 'pages') endpoint = path[4] ? 'pages.get' : 'pages.list';
      else if (path[3] === 'control') endpoint = 'jobs.control';
      else if (path[3] === 'export') endpoint = 'export';
      else endpoint = method === 'DELETE' ? 'jobs.delete' : 'jobs.get';
      const request = new Request(new URL(input.url, 'http://localhost:3001'), {
        method,
        headers: {
          ...(input.payload !== undefined ? { 'content-type': 'application/json' } : {}),
          ...input.headers,
        },
        body: input.payload !== undefined ? JSON.stringify(input.payload) : undefined,
      });
      const response = await handleEndpoint(
        endpoint,
        request,
        { id: path[2], page: path[4] },
        runtime,
      );
      const body = await response.text();
      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers),
        body,
        json: () => JSON.parse(body),
      };
    },
  };
}

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';
import { safeFetch } from '../server/crawler/fetch';
import { inScope } from '../server/crawler/security';

// A real HTTP fixture server; only the transport socket is redirected inside this test.
// The production URL policy, DNS validation, redirect loop and body reader all execute.
test('HTTP transport: pinned DNS, redirects, timeout, body limits, status and cancellation', async (t) => {
  const fixture = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { location: '/ok' });
      res.end();
    } else if (req.url === '/private') {
      res.writeHead(302, { location: 'http://127.0.0.1/secret' });
      res.end();
    } else if (req.url === '/external') {
      res.writeHead(302, { location: 'http://other.example.org/' });
      res.end();
    } else if (req.url === '/loop') {
      res.writeHead(302, { location: '/loop' });
      res.end();
    } else if (req.url === '/large') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('x'.repeat(4096));
    } else if (req.url === '/length') {
      res.writeHead(200, { 'content-length': '999999999' });
      res.end();
    } else if (req.url === '/slow') {
      const timer = setTimeout(() => res.end('late'), 500);
      res.on('close', () => clearTimeout(timer));
    } else if (req.url === '/compressed') {
      res.writeHead(200, { 'content-encoding': 'gzip', 'content-type': 'text/html' });
      res.end(gzipSync('<p>Compressed content</p>'));
    } else if (req.url === '/bomb') {
      res.writeHead(200, { 'content-encoding': 'gzip' });
      res.end(gzipSync('x'.repeat(100000)));
    } else {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<title>Live HTTP fixture</title><p>hello</p>');
    }
  });
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  const port = (fixture.address() as AddressInfo).port;
  const original = http.request;
  let pinned = false;
  const transport = mock.method(http, 'request', ((
    url: URL,
    options: http.RequestOptions,
    callback: (res: http.IncomingMessage) => void,
  ) => {
    assert(options.lookup);
    assert.equal(options.family, 4);
    pinned = true;
    return original(
      new URL(`http://127.0.0.1:${port}${url.pathname}`),
      { ...options, lookup: undefined },
      callback,
    );
  }) as typeof http.request);
  const options = {
    timeoutMs: 1000,
    signal: new AbortController().signal,
    scope: (url: string) => inScope(url, 'http://public.example.org'),
    resolver: async () => [{ address: '1.1.1.1', family: 4 }],
  };
  try {
    await t.test('follows same-host redirect with DNS pinned on both hops', async () => {
      const result = await safeFetch('http://public.example.org/redirect', options);
      assert.equal(result.status, 200);
      assert.equal(result.url, 'http://public.example.org/ok');
      assert.match(result.body, /Live HTTP fixture/);
      assert(pinned);
    });
    await t.test('blocks private redirect even when scope permits it', async () =>
      assert.rejects(
        safeFetch('http://public.example.org/private', { ...options, scope: () => true }),
        /private|internal/,
      ),
    );
    await t.test('blocks external host redirects', async () =>
      assert.rejects(safeFetch('http://public.example.org/external', options), /allowed/),
    );
    await t.test('bounds redirect loops', async () =>
      assert.rejects(safeFetch('http://public.example.org/loop', options), /Too many/),
    );
    await t.test('bounds streamed responses', async () =>
      assert.rejects(
        safeFetch('http://public.example.org/large', { ...options, maxBytes: 100 }),
        /size limit/,
      ),
    );
    await t.test('rejects oversized Content-Length', async () =>
      assert.rejects(
        safeFetch('http://public.example.org/length', { ...options, maxBytes: 100 }),
        /size limit/,
      ),
    );
    await t.test('enforces request deadline', async () =>
      assert.rejects(
        safeFetch('http://public.example.org/slow', { ...options, timeoutMs: 30 }),
        /timed out/,
      ),
    );
    await t.test('cancellation interrupts HTTP request', async () => {
      const controller = new AbortController();
      const result = safeFetch('http://public.example.org/slow', {
        ...options,
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(), 20);
      await assert.rejects(result, /interrupted/);
    });
    await t.test('supports bounded gzip responses', async () =>
      assert.match(
        (await safeFetch('http://public.example.org/compressed', options)).body,
        /Compressed content/,
      ),
    );
    await t.test('rejects decompression bombs', async () =>
      assert.rejects(
        safeFetch('http://public.example.org/bomb', { ...options, maxBytes: 1024 }),
        /size limit/,
      ),
    );
  } finally {
    transport.mock.restore();
    fixture.closeAllConnections();
    await new Promise<void>((resolve) => fixture.close(() => resolve()));
  }
});

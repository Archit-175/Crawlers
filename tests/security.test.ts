import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPublicAddress,
  normalizeUrl,
  resolvePublicUrl,
  inScope,
} from '../server/crawler/security';
import { extract, sitemapLocations } from '../server/crawler/extract';
import { csvCell, session, validSession } from '../server/auth';
import { readConfig } from '../server/config';
for (const address of [
  '127.0.0.1',
  '10.0.0.1',
  '192.168.4.2',
  '172.16.0.1',
  '169.254.169.254',
  '100.64.0.1',
  '0.0.0.0',
  '255.255.255.255',
  '192.0.2.1',
  '198.18.0.1',
  '224.0.0.1',
  '::1',
  '::',
  'fe80::1',
  'fc00::1',
  '::ffff:127.0.0.1',
  '::ffff:10.0.0.1',
  '2001:db8::1',
  '64:ff9b::a00:1',
])
  test(`blocks non-public address ${address}`, () => assert.equal(isPublicAddress(address), false));
for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])
  test(`allows public address ${address}`, () => assert.equal(isPublicAddress(address), true));
for (const url of [
  'file:///etc/passwd',
  'javascript:alert(1)',
  'ftp://example.org',
  'http://user:pass@example.org',
  'http://example.org:8080',
  'not a URL',
])
  test(`rejects unsafe URL ${url}`, () => assert.throws(() => normalizeUrl(url)));
test('normalizes hostname, default ports, dot segments and fragments without mutating query semantics', () =>
  assert.equal(
    normalizeUrl('HTTPS://Example.org:443/a/../b?z=1&a=2#part'),
    'https://example.org/b?z=1&a=2',
  ));
test('relative links and duplicate fragment variants converge', () =>
  assert.equal(
    normalizeUrl('../tree#leaf', 'https://example.org/path/page'),
    'https://example.org/tree',
  ));
test('blocks alternate IPv4 encoding', async () => {
  for (const host of ['2130706433', '0x7f000001', '127.1'])
    await assert.rejects(resolvePublicUrl(`http://${host}`), /private|internal/);
});
test('rejects mixed public/private DNS answers', async () =>
  assert.rejects(
    resolvePublicUrl('https://example.org', async () => [
      { address: '1.1.1.1', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]),
    /private/,
  ));
test('DNS validation returns a pinned public address', async () => {
  const result = await resolvePublicUrl('https://example.org', async () => [
    { address: '1.1.1.1', family: 4 },
  ]);
  assert.equal(result.address, '1.1.1.1');
  assert.equal(result.url.hostname, 'example.org');
});
test('domain and path restrictions', () => {
  assert(inScope('https://example.org/docs/a', 'http://example.org', '/docs/'));
  assert(!inScope('https://evil.example.org/docs', 'https://example.org'));
  assert(!inScope('https://example.org/private', 'https://example.org', '/docs'));
  assert(!inScope('https://example.org.evil.com', 'https://example.org'));
});
test('extracts structured metadata safely, ignores active code, deduplicates links', () => {
  const result = extract(
    '<html lang="en"><head><title> Forest research </title><meta name="description" content="Useful notes"><link rel="canonical" href="/canon"><script type="application/ld+json">{"@type":"Article"}</script></head><body><main><h1>Forest</h1><p>Two trees</p><script>evil()</script><style>hidden</style><a href="/next#one">Next</a><a href="/next#two">Again</a><a href="javascript:evil()">Bad</a><img src="/tree.jpg" alt="A tree"></main></body></html>',
    'https://example.org',
  );
  assert.equal(result.title, 'Forest research');
  assert.equal(result.language, 'en');
  assert.equal(result.description, 'Useful notes');
  assert.equal(result.canonical, 'https://example.org/canon');
  assert.deepEqual(result.links, ['https://example.org/next']);
  assert.equal(result.headings[0].text, 'Forest');
  assert(!result.text.includes('evil()'));
  assert.equal(result.structuredData.length, 1);
  assert.equal(result.images[0].alt, 'A tree');
  assert(result.wordCount > 0);
});
test('empty HTML has valid empty extraction', () => {
  const result = extract('', 'https://example.org');
  assert.equal(result.wordCount, 0);
  assert.equal(result.text, '');
});
test('malformed JSON-LD is ignored and text is bounded', () => {
  const result = extract(
    `<script type="application/ld+json">broken</script><p>${'x '.repeat(200000)}</p>`,
    'https://example.org',
  );
  assert.equal(result.structuredData.length, 0);
  assert(result.text.length <= 150000);
});
test('parses sitemap URL sets and sitemap indexes without external entity expansion', () => {
  assert.deepEqual(
    sitemapLocations('<urlset><url><loc>https://example.org/tree</loc></url></urlset>').pages,
    ['https://example.org/tree'],
  );
  assert.deepEqual(
    sitemapLocations(
      '<sitemapindex><sitemap><loc>https://example.org/a.xml</loc></sitemap></sitemapindex>',
    ).maps,
    ['https://example.org/a.xml'],
  );
  assert(
    !sitemapLocations(
      '<!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><urlset><url><loc>&xxe;</loc></url></urlset>',
    )
      .pages.join('')
      .includes('root:'),
  );
});
test('CSV prevents formula execution and escapes quotes', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('  @cmd'), '"\'  @cmd"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
test('signed sessions reject tampering and expiry', () => {
  const key = 'a'.repeat(32);
  assert(validSession(session(key), key));
  assert(!validSession(session(key), 'b'.repeat(32)));
  assert(!validSession('0.invalid', key));
  assert(!validSession(undefined, key));
});
test('public binds and production require authentication', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /CRAWL_API_KEY/);
  assert.throws(() => readConfig({ HOST: '0.0.0.0' }), /CRAWL_API_KEY/);
  assert.throws(() => readConfig({ CRAWL_API_KEY: 'short' }), /configuration/);
  assert.equal(readConfig({}).HOST, '127.0.0.1');
});

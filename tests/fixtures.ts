import { setTimeout as delay } from 'node:timers/promises';
import type { Fetcher, FetchResult } from '../server/crawler/fetch';
export const fixtureHost = 'https://research.example.org';
export function fixtures(
  options: { latency?: number; robots?: string; failRobots?: boolean } = {},
) {
  const calls: string[] = [];
  let active = 0,
    maxActive = 0;
  const attempts = new Map<string, number>();
  const fetcher: Fetcher = async (url, config) => {
    if (!config.scope(url)) throw new Error('Out of fixture scope');
    await config.beforeRequest?.(url);
    config.signal.throwIfAborted();
    calls.push(url);
    active++;
    maxActive = Math.max(active, maxActive);
    try {
      await delay(options.latency ?? 10, undefined, { signal: config.signal });
      const path = new URL(url).pathname;
      const result: FetchResult = {
        url,
        status: 200,
        body: '',
        contentType: 'text/html',
        responseMs: options.latency ?? 10,
        retryAfter: null,
      };
      if (path === '/robots.txt')
        return {
          ...result,
          status: options.failRobots ? 503 : 200,
          body:
            options.robots ??
            'User-agent: *\nDisallow: /private\nSitemap: https://research.example.org/sitemap.xml',
          contentType: 'text/plain',
        };
      if (path === '/sitemap.xml')
        return {
          ...result,
          body: `<sitemapindex><sitemap><loc>${fixtureHost}/map.xml</loc></sitemap></sitemapindex>`,
          contentType: 'application/xml',
        };
      if (path === '/map.xml')
        return {
          ...result,
          body: `<urlset><url><loc>${fixtureHost}/sitemap-only</loc></url></urlset>`,
          contentType: 'application/xml',
        };
      if (path === '/')
        return {
          ...result,
          body: '<title>Forest research</title><main><h1>Our forests</h1><p>Field notes and discoveries.</p><a href="/a">A</a><a href="/a#duplicate">Again</a><a href="/b">B</a><a href="/private">Private</a><a href="https://elsewhere.example.org/">External</a><a href="/broken">Broken</a><a href="/retry">Retry</a><a href="/document">PDF</a><a href="/empty">Empty</a></main>',
        };
      if (path === '/broken') return { ...result, status: 404 };
      if (path === '/document') return { ...result, contentType: 'application/pdf' };
      if (path === '/empty') return result;
      if (path === '/retry') {
        const n = (attempts.get(path) ?? 0) + 1;
        attempts.set(path, n);
        if (n === 1) return { ...result, status: 503 };
      }
      return {
        ...result,
        body: `<title>${path === '/' ? 'Home' : path.slice(1)} forest</title><meta name="description" content="Forest notes"><main><h1>Conservation</h1><p>Our forest research matters.</p><a href="/deeper">Explore more</a></main>`,
      };
    } finally {
      active--;
    }
  };
  return {
    fetcher,
    calls,
    get maxActive() {
      return maxActive;
    },
  };
}
export async function until(check: () => boolean, timeout = 15000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Condition timed out');
    await delay(20);
  }
}

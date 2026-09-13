import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import parserPackage from 'robots-parser';
import { Store } from '../store';
import { safeFetch, USER_AGENT, type Fetcher } from './fetch';
import { CrawlError, inScope, normalizeUrl } from './security';
import { extract, sitemapLocations } from './extract';
import type { Job, Page } from '../../shared/types';

interface RobotsRules {
  isAllowed(url: string, userAgent: string): boolean | undefined;
  getCrawlDelay(userAgent: string): number | undefined;
  getSitemaps(): string[];
}
// robots-parser's CommonJS package ships a declaration incompatible with NodeNext.
const robotsParser = parserPackage as unknown as (url: string, text: string) => RobotsRules;

/** A single durable job scheduler. Page requests inside the active job run concurrently. */
export class Engine extends EventEmitter {
  private active?: { id: string; controller: AbortController; done: Promise<void> };
  private closing = false;
  constructor(
    public store: Store,
    private fetcher: Fetcher = safeFetch,
  ) {
    super();
    this.setMaxListeners(100);
  }
  notify() {
    this.emit('change');
  }
  kick() {
    if (this.active || this.closing) return;
    const job = this.store
      .jobs()
      .reverse()
      .find((item) => item.status === 'queued');
    if (!job) return;
    const controller = new AbortController();
    const done = this.run(job, controller.signal).finally(() => {
      this.active = undefined;
      this.notify();
      this.kick();
    });
    this.active = { id: job.id, controller, done };
  }
  async control(id: string, action: 'pause' | 'resume' | 'stop' | 'retry') {
    const job = this.store.job(id);
    if (!job) throw new CrawlError('NOT_FOUND', 'Crawl not found.');
    const valid =
      action === 'pause'
        ? ['queued', 'running']
        : action === 'resume'
          ? ['paused']
          : action === 'stop'
            ? ['queued', 'running', 'paused']
            : ['completed', 'failed', 'stopped'];
    if (!valid.includes(job.status))
      throw new CrawlError('CONFLICT', `Cannot ${action} a ${job.status} crawl.`);
    if (action === 'retry' && !job.failed)
      throw new CrawlError('CONFLICT', 'There are no failed pages to retry.');
    if (action === 'resume') this.store.status(id, 'queued');
    else if (action === 'retry') this.store.retry(id);
    else {
      this.store.status(id, action === 'pause' ? 'paused' : 'stopped');
      if (this.active?.id === id) {
        this.active.controller.abort();
        await this.active.done;
      }
    }
    this.notify();
    this.kick();
  }
  async shutdown() {
    this.closing = true;
    if (this.active) {
      this.store.status(this.active.id, 'paused');
      this.active.controller.abort();
      await this.active.done;
    }
  }
  private async run(job: Job, signal: AbortSignal) {
    const config = job.config;
    this.store.status(job.id, 'running');
    this.notify();
    let nextRequestAt = 0;
    let robotDelay = 0;
    let gateTail = Promise.resolve();
    const gate = () => {
      const turn = gateTail.then(async () => {
        signal.throwIfAborted();
        // Recheck after waking: another response may have extended Retry-After.
        while (Date.now() < nextRequestAt)
          await delay(nextRequestAt - Date.now(), undefined, { signal });
        nextRequestAt = Date.now() + Math.max(config.delayMs, robotDelay);
      });
      gateTail = turn.catch(() => {});
      return turn;
    };
    const robots = new Map<string, Promise<ReturnType<typeof robotsParser>>>();
    const getRobots = (url: string) => {
      const origin = new URL(url).origin;
      if (!robots.has(origin))
        robots.set(
          origin,
          (async () => {
            const address = `${origin}/robots.txt`;
            const response = await this.fetcher(address, {
              timeoutMs: config.timeoutMs + config.delayMs,
              maxBytes: 512000,
              signal,
              scope: (u) => inScope(u, job.url),
              beforeRequest: gate,
            });
            if (response.status === 401 || response.status === 403)
              return robotsParser(address, 'User-agent: *\nDisallow: /');
            if (
              response.status !== 404 &&
              response.status !== 410 &&
              (response.status < 200 || response.status >= 300)
            )
              throw new CrawlError(
                'ROBOTS_UNAVAILABLE',
                `robots.txt returned HTTP ${response.status}; crawl stopped conservatively.`,
              );
            const rules = robotsParser(
              address,
              response.status === 404 || response.status === 410 ? '' : response.body,
            );
            const seconds = rules.getCrawlDelay(USER_AGENT) ?? rules.getCrawlDelay('*') ?? 0;
            if (seconds > 120)
              throw new CrawlError(
                'ROBOTS_DELAY',
                'robots.txt requires a delay over 120 seconds; this host is not supported.',
              );
            robotDelay = Math.max(robotDelay, seconds * 1000);
            nextRequestAt = Math.max(nextRequestAt, Date.now() + robotDelay);
            return rules;
          })(),
        );
      return robots.get(origin)!;
    };
    const beforePage = async (url: string) => {
      const rules = await getRobots(url);
      if (rules.isAllowed(url, USER_AGENT) === false)
        throw new CrawlError('ROBOTS_BLOCKED', 'Disallowed by robots.txt.');
      await gate();
    };
    const add = (input: string, base: string, depth: number) => {
      try {
        const url = normalizeUrl(input, base);
        if (inScope(url, job.url, config.pathPrefix))
          this.store.enqueue(job.id, url, depth, config.maxPages);
      } catch {
        /* Non-web and malformed links are not crawl candidates. */
      }
    };
    const fetchPage = async (page: Page) => {
      for (let attempt = 0; attempt <= config.retries; attempt++) {
        try {
          signal.throwIfAborted();
          this.store.attempt(page.id);
          this.notify();
          const result = await this.fetcher(page.url, {
            timeoutMs: config.timeoutMs + Math.max(config.delayMs, robotDelay) * config.concurrency,
            signal,
            scope: (url) => inScope(url, job.url, config.pathPrefix),
            beforeRequest: beforePage,
          });
          if ([408, 429, 500, 502, 503, 504].includes(result.status) && attempt < config.retries) {
            const requested = result.retryAfter
              ? /^\d+$/.test(result.retryAfter)
                ? Number(result.retryAfter) * 1000
                : Date.parse(result.retryAfter) - Date.now()
              : 0;
            if (requested > 120000) {
              this.store.finish(page.id, 'failed', {
                ...result,
                error: `HTTP_${result.status}: Retry-After exceeds the supported 120 seconds.`,
              });
              break;
            }
            const wait = Math.max(500 * 2 ** attempt, Number.isFinite(requested) ? requested : 0);
            nextRequestAt = Math.max(nextRequestAt, Date.now() + wait);
            await delay(wait, undefined, { signal });
            continue;
          }
          if (result.status < 200 || result.status >= 300)
            this.store.finish(page.id, 'failed', {
              ...result,
              error: `HTTP_${result.status}: Server returned HTTP ${result.status}.`,
            });
          else if (!/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(result.contentType))
            this.store.finish(page.id, 'skipped', {
              ...result,
              error: 'NON_HTML: Only HTML pages are extracted.',
            });
          else {
            const data = extract(result.body, result.url);
            this.store.transaction(() => {
              this.store.finish(page.id, 'success', { ...result, data });
              if (page.depth < config.maxDepth)
                data.links.forEach((url) => add(url, result.url, page.depth + 1));
            });
          }
          break;
        } catch (error) {
          if (signal.aborted) {
            this.store.finish(page.id, 'queued');
            break;
          }
          const reason =
            error instanceof CrawlError
              ? error
              : new CrawlError('INTERNAL', 'Unexpected extraction failure.');
          if (reason.retryable && attempt < config.retries) {
            await delay(500 * 2 ** attempt, undefined, { signal }).catch(() => {});
            continue;
          }
          this.store.finish(
            page.id,
            ['ROBOTS_BLOCKED', 'SSRF_BLOCKED', 'OUT_OF_SCOPE', 'UNSAFE_URL'].includes(reason.code)
              ? 'blocked'
              : 'failed',
            { error: `${reason.code}: ${reason.message}` },
          );
          break;
        }
      }
      this.notify();
    };
    try {
      const rules = await getRobots(job.url);
      if (config.useSitemap && config.maxDepth > 0) {
        const pending = rules.getSitemaps().length
          ? rules.getSitemaps().slice(0, 5)
          : [new URL('/sitemap.xml', job.url).href];
        const seen = new Set<string>();
        while (pending.length && seen.size < 5) {
          const map = pending.shift()!;
          if (!inScope(map, job.url) || seen.has(map)) continue;
          seen.add(map);
          try {
            const result = await this.fetcher(map, {
              timeoutMs: config.timeoutMs + Math.max(config.delayMs, robotDelay),
              maxBytes: 1024000,
              signal,
              scope: (url) => inScope(url, job.url),
              beforeRequest: beforePage,
            });
            if (result.status === 200) {
              const entries = sitemapLocations(result.body);
              entries.pages.forEach((url) => add(url, map, 1));
              pending.push(...entries.maps);
            }
          } catch (error) {
            if (signal.aborted) throw error; /* Sitemaps supplement ordinary discovery. */
          }
        }
      }
      const running = new Set<Promise<void>>();
      while (!signal.aborted) {
        while (running.size < config.concurrency) {
          const page = this.store.claim(job.id);
          if (!page) break;
          const task = fetchPage(page).finally(() => running.delete(task));
          running.add(task);
        }
        if (!running.size) break;
        await Promise.race(running);
      }
      await Promise.allSettled(running);
      if (!signal.aborted) {
        const result = this.store.job(job.id)!;
        this.store.status(
          job.id,
          result.crawled === 0 && result.failed > 0 ? 'failed' : 'completed',
        );
      }
    } catch (error) {
      if (!signal.aborted)
        this.store.status(
          job.id,
          'failed',
          error instanceof CrawlError
            ? `${error.code}: ${error.message}`
            : 'Crawl failed unexpectedly.',
        );
    }
    this.notify();
  }
}

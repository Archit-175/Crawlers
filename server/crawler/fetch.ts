import http from 'node:http';
import https from 'node:https';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { CrawlError, normalizeUrl, resolvePublicUrl, type Resolver } from './security';

export const USER_AGENT = 'WebWondersCrawler/2.0';
export interface FetchOptions {
  timeoutMs: number;
  maxBytes?: number;
  signal: AbortSignal;
  scope: (url: string) => boolean;
  beforeRequest?: (url: string) => Promise<void>;
  resolver?: Resolver;
}
export interface FetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
  responseMs: number;
  retryAfter: string | null;
}
export type Fetcher = (url: string, options: FetchOptions) => Promise<FetchResult>;

export const safeFetch: Fetcher = async (input, options) => {
  const started = performance.now();
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)]);
  const abort = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  const run = async () => {
    let current = normalizeUrl(input);
    for (let hop = 0; hop <= 5; hop++) {
      signal.throwIfAborted();
      if (!options.scope(current))
        throw new CrawlError('OUT_OF_SCOPE', 'Redirect left the allowed host or path.');
      await options.beforeRequest?.(current);
      const target = await resolvePublicUrl(current, options.resolver);
      signal.throwIfAborted();
      const result = await new Promise<{
        status: number;
        location?: string;
        contentType: string;
        body: string;
        retryAfter: string | null;
      }>((resolve, reject) => {
        const transport = target.url.protocol === 'https:' ? https : http;
        const req = transport.request(
          target.url,
          {
            method: 'GET',
            signal,
            agent: false,
            family: target.family,
            // Pin the validated IP. The original hostname remains the TLS SNI and Host header.
            lookup: (_hostname, _opts, callback) => callback(null, target.address, target.family),
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.8',
              'Accept-Encoding': 'identity',
            },
          },
          (res) => {
            const status = res.statusCode ?? 0;
            const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
            const retryAfter = res.headers['retry-after'] ?? null;
            if ([301, 302, 303, 307, 308].includes(status)) {
              res.destroy();
              resolve({
                status,
                location: res.headers.location,
                body: '',
                contentType,
                retryAfter,
              });
              return;
            }
            const max = options.maxBytes ?? 2 * 1024 * 1024;
            if (Number(res.headers['content-length']) > max) {
              res.destroy();
              reject(new CrawlError('TOO_LARGE', 'Response exceeds the size limit.'));
              return;
            }
            const encoding = res.headers['content-encoding']?.trim().toLowerCase();
            const decoder =
              encoding === 'gzip'
                ? createGunzip()
                : encoding === 'deflate'
                  ? createInflate()
                  : encoding === 'br'
                    ? createBrotliDecompress()
                    : null;
            if (encoding && encoding !== 'identity' && !decoder) {
              res.destroy();
              reject(new CrawlError('ENCODING', 'Unsupported content encoding.'));
              return;
            }
            const bodyStream = decoder ?? res;
            const chunks: Buffer[] = [];
            let size = 0;
            let wireSize = 0;
            const tooLarge = () => {
              decoder?.destroy();
              res.destroy();
              reject(new CrawlError('TOO_LARGE', 'Response exceeds the size limit.'));
            };
            // Bound both compressed wire bytes and decompressed bytes to prevent expansion bombs.
            res.on('data', (chunk: Buffer) => {
              wireSize += chunk.length;
              if (wireSize > max) tooLarge();
            });
            bodyStream.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > max) tooLarge();
              else chunks.push(chunk);
            });
            bodyStream.on('end', () =>
              resolve({
                status,
                contentType,
                body: Buffer.concat(chunks).toString('utf8'),
                retryAfter,
              }),
            );
            res.on('error', (error) => {
              decoder?.destroy();
              reject(error);
            });
            if (decoder) {
              decoder.on('error', () => {
                res.destroy();
                reject(new CrawlError('ENCODING', 'Invalid compressed response.'));
              });
              res.pipe(decoder);
            }
          },
        );
        req.on('error', reject);
        req.end();
      });
      if ([301, 302, 303, 307, 308].includes(result.status)) {
        if (!result.location)
          throw new CrawlError('REDIRECT', 'Redirect response has no Location header.');
        current = normalizeUrl(result.location, current);
        continue;
      }
      return { ...result, url: current, responseMs: Math.round(performance.now() - started) };
    }
    throw new CrawlError('REDIRECT_LIMIT', 'Too many redirects.');
  };
  try {
    return await Promise.race([run(), abort]);
  } catch (error) {
    if (options.signal.aborted) throw new CrawlError('ABORTED', 'Crawl interrupted.');
    if (signal.aborted) throw new CrawlError('TIMEOUT', 'Request timed out.', true);
    if (error instanceof CrawlError) throw error;
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      /^[A-Z0-9_]+$/.test(error.code)
        ? ` (${error.code})`
        : '';
    throw new CrawlError('NETWORK', `Connection or DNS lookup failed${code}.`, true);
  }
};

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getRuntime, type Runtime } from './runtime';
import { CrawlError, normalizeUrl, inScope } from './crawler/security';
import { crawlConfigSchema } from '../shared/types';
import { csvCell, equal, session, validSession } from './auth';

export type Endpoint =
  | 'health'
  | 'session.get'
  | 'session.login'
  | 'session.logout'
  | 'library'
  | 'weather'
  | 'jobs.list'
  | 'jobs.create'
  | 'jobs.get'
  | 'jobs.control'
  | 'jobs.delete'
  | 'pages.list'
  | 'pages.get'
  | 'export'
  | 'events';
type Params = Record<string, string>;
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
function cookie(req: Request) {
  return req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('crawlers_session='))
    ?.slice('crawlers_session='.length);
}
async function body(req: Request): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') ?? ''))
    throw new HttpError(415, 'Use application/json.');
  if (Number(req.headers.get('content-length')) > 16384)
    throw new HttpError(413, 'Request body exceeds 16 KiB.');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.length;
      if (length > 16384) {
        await reader.cancel();
        throw new HttpError(413, 'Request body exceeds 16 KiB.');
      }
      chunks.push(item.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid JSON body.');
  } finally {
    reader.releaseLock();
  }
}
function guard(req: Request, endpoint: Endpoint, runtime: Runtime) {
  if (runtime.closing) throw new HttpError(503, 'The server is shutting down.');
  const { config } = runtime;
  const origins = new Set([
    config.APP_ORIGIN,
    ...(config.NODE_ENV === 'development'
      ? [`http://localhost:${config.PORT}`, `http://127.0.0.1:${config.PORT}`]
      : []),
  ]);
  if (![...origins].some((origin) => new URL(origin).host === req.headers.get('host')))
    throw new HttpError(403, 'Unrecognized host.');
  if (req.headers.get('origin') && !origins.has(req.headers.get('origin')!))
    throw new HttpError(403, 'Cross-origin requests are not allowed.');
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new HttpError(403, 'Cross-site API requests are not allowed.');
  // Only the custom Node entry point can attest to the socket peer; forwarded headers are untrusted.
  const transport = (globalThis as typeof globalThis & { __crawlersTransportToken?: string })
    .__crawlersTransportToken;
  const ip =
    transport && equal(req.headers.get('x-crawlers-transport') ?? '', transport)
      ? (req.headers.get('x-crawlers-peer') ?? 'shared')
      : 'shared';
  const limits: [string, number, number][] = [['api', 240, 60000]];
  if (endpoint === 'session.login') limits.push(['login', 8, 60000]);
  if (endpoint === 'jobs.create') limits.push(['create', 20, 3600000]);
  for (const [scope, max, window] of limits) {
    const wait = runtime.limiter.take(`${scope}:${ip}`, max, window);
    if (wait)
      return json({ error: 'Too many requests. Try again later.' }, 429, {
        'Retry-After': String(wait),
      });
  }
  if (
    !['health', 'session.get', 'session.login', 'session.logout', 'library', 'weather'].includes(
      endpoint,
    ) &&
    config.CRAWL_API_KEY &&
    !validSession(cookie(req), config.CRAWL_API_KEY) &&
    !equal(req.headers.get('authorization') ?? '', `Bearer ${config.CRAWL_API_KEY}`)
  )
    throw new HttpError(401, 'Sign in to access this workspace.');
}
function streamEvents(req: Request, runtime: Runtime) {
  if (runtime.connections.size >= 30) throw new HttpError(429, 'Too many live connections.');
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let dirty = true;
        let closed = false;
        const encoder = new TextEncoder();
        const changed = () => {
          dirty = true;
        };
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          clearTimeout(expires);
          runtime.engine.off('change', changed);
          runtime.connections.delete(close);
          req.signal.removeEventListener('abort', close);
          try {
            controller.close();
          } catch {
            /* Consumer already canceled. */
          }
        };
        const send = () => {
          if (closed) return;
          if ((controller.desiredSize ?? 0) < 0) {
            close();
            return;
          }
          controller.enqueue(
            encoder.encode(
              dirty
                ? `event: update\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`
                : ': heartbeat\n\n',
            ),
          );
          dirty = false;
        };
        const timer = setInterval(send, 1000);
        const expires = setTimeout(close, 30 * 60 * 1000);
        cleanup = close;
        runtime.engine.on('change', changed);
        runtime.connections.add(close);
        req.signal.addEventListener('abort', close, { once: true });
        if (req.signal.aborted) close();
        else send();
      },
      cancel() {
        cleanup();
      },
    },
    { highWaterMark: 65536, size: (chunk) => chunk.byteLength },
  );
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function handleEndpoint(
  endpoint: Endpoint,
  req: Request,
  params: Params,
  runtime: Runtime,
): Promise<Response> {
  const { config, store, engine } = runtime;
  const query = Object.fromEntries(new URL(req.url).searchParams);
  let response: Response;
  try {
    const limited = guard(req, endpoint, runtime);
    if (limited) return limited;
    if (endpoint === 'health') {
      store.db.prepare('SELECT 1').get();
      response = json({ status: 'ok', version: '3.0.0', framework: 'nextjs' });
    } else if (endpoint === 'session.get')
      response = json({
        authenticated: !config.CRAWL_API_KEY || validSession(cookie(req), config.CRAWL_API_KEY),
        required: !!config.CRAWL_API_KEY,
      });
    else if (endpoint === 'session.login') {
      const { key } = z.object({ key: z.string().max(300) }).parse(await body(req));
      if (!config.CRAWL_API_KEY || !equal(key, config.CRAWL_API_KEY))
        throw new HttpError(401, 'Invalid workspace key.');
      response = json({ authenticated: true }, 200, {
        'Set-Cookie': `crawlers_session=${session(key)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${new URL(config.APP_ORIGIN).protocol === 'https:' ? '; Secure' : ''}`,
      });
    } else if (endpoint === 'session.logout')
      response = json({ authenticated: false }, 200, {
        'Set-Cookie': 'crawlers_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
      });
    else if (endpoint === 'library')
      response = json(JSON.parse(readFileSync(resolve('public/library.json'), 'utf8')));
    else if (endpoint === 'weather') response = await weather(query, runtime);
    else if (endpoint === 'jobs.list') response = json({ items: store.jobs() });
    else if (endpoint === 'jobs.create') {
      const input = crawlConfigSchema.parse(await body(req));
      input.url = normalizeUrl(input.url);
      if (input.pathPrefix && !input.pathPrefix.startsWith('/'))
        throw new CrawlError('INVALID_CONFIG', 'Path prefix must start with /.');
      if (!inScope(input.url, input.url, input.pathPrefix))
        throw new CrawlError('INVALID_CONFIG', 'The seed URL must match the path prefix.');
      if (store.jobs().length >= 100)
        throw new CrawlError(
          'CONFLICT',
          'Export and delete old jobs before creating more than 100 jobs.',
        );
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          runtime.validateTarget(input.url),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new CrawlError('DNS_TIMEOUT', 'Host validation timed out.')),
              5000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      if (runtime.closing) throw new HttpError(503, 'The server is shutting down.');
      if (store.jobs().length >= 100)
        throw new CrawlError('CONFLICT', 'Workspace job limit reached.');
      const job = store.create(input);
      engine.notify();
      engine.kick();
      response = json(job, 201);
    } else if (endpoint === 'events') response = streamEvents(req, runtime);
    else {
      const id = z.uuid().parse(params.id);
      const job = store.job(id);
      if (!job) throw new CrawlError('NOT_FOUND', 'Crawl not found.');
      if (endpoint === 'jobs.get') response = json(job);
      else if (endpoint === 'jobs.control') {
        const { action } = z
          .object({ action: z.enum(['pause', 'resume', 'stop', 'retry']) })
          .parse(await body(req));
        await engine.control(id, action);
        response = json(store.job(id));
      } else if (endpoint === 'jobs.delete') {
        if (['running', 'queued'].includes(job.status))
          throw new CrawlError('CONFLICT', 'Stop the crawl before deleting it.');
        store.delete(id);
        engine.notify();
        response = new Response(null, { status: 204 });
      } else if (endpoint === 'pages.list') {
        const options = z
          .object({
            search: z.string().max(200).optional(),
            status: z
              .enum(['', 'queued', 'fetching', 'success', 'failed', 'blocked', 'skipped'])
              .optional(),
            offset: z.coerce.number().int().min(0).max(500).default(0),
            limit: z.coerce.number().int().min(1).max(100).default(25),
            sort: z.enum(['url', 'title', 'response']).optional(),
          })
          .parse(query);
        response = json(store.pages(id, options));
      } else if (endpoint === 'pages.get') {
        const page = store.page(id, z.coerce.number().int().positive().parse(params.page));
        if (!page) throw new CrawlError('NOT_FOUND', 'Page not found.');
        response = json(page);
      } else {
        const { format } = z
          .object({ format: z.enum(['csv', 'json']).default('json') })
          .parse(query);
        const pages = store.pages(id, { limit: 500 }).items;
        const headers = { 'Content-Disposition': `attachment; filename="crawl-${id}.${format}"` };
        if (format === 'json')
          response = json(
            { job, pages: pages.map((page) => store.page(id, page.id)) },
            200,
            headers,
          );
        else {
          const columns = [
            'url',
            'finalUrl',
            'status',
            'statusCode',
            'title',
            'wordCount',
            'responseMs',
            'depth',
            'attempts',
            'error',
          ] as const;
          response = new Response(
            '\uFEFF' +
              [
                columns.map(csvCell).join(','),
                ...pages.map((page) => columns.map((key) => csvCell(page[key])).join(',')),
              ].join('\r\n'),
            { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } },
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError)
      response = json(
        {
          error: error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        },
        400,
      );
    else if (error instanceof HttpError) response = json({ error: error.message }, error.status);
    else if (
      error instanceof Error &&
      error.name === 'CrawlError' &&
      'code' in error &&
      typeof error.code === 'string'
    )
      response = json(
        { error: error.message, code: error.code },
        error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400,
      );
    else {
      runtime.log.error({ err: error, endpoint }, 'API request failed');
      response = json({ error: 'The server could not complete this request.' }, 500);
    }
  }
  if (endpoint !== 'events') response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

async function weather(query: Record<string, string>, runtime: Runtime) {
  const { config, weatherCache } = runtime;
  if (!config.OPENWEATHER_API_KEY) throw new HttpError(503, 'Live weather is not configured.');
  const coords = z
    .object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) })
    .parse(query);
  const key = `${coords.lat},${coords.lon}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < 600000) return json(cached.value);
  try {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.search = new URLSearchParams({
      lat: String(coords.lat),
      lon: String(coords.lon),
      units: 'metric',
      appid: config.OPENWEATHER_API_KEY,
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw new Error('Provider failed');
    const value = z
      .object({
        main: z.object({ temp: z.number(), humidity: z.number() }),
        weather: z.array(z.object({ main: z.string() })),
      })
      .parse(await response.json());
    if (weatherCache.size >= 100) weatherCache.delete(weatherCache.keys().next().value!);
    weatherCache.set(key, { at: Date.now(), value });
    return json(value);
  } catch {
    throw new HttpError(502, 'Weather provider unavailable.');
  }
}

/** Each App Router endpoint exports its own allowed HTTP method using this wrapper. */
export function route(endpoint: Endpoint) {
  return async (req: Request, context: { params?: Promise<Params> } = {}) =>
    handleEndpoint(endpoint, req, (await context.params) ?? {}, getRuntime());
}

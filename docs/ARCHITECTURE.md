# Architecture and operational boundaries

Next.js 16 App Router owns server-rendered pages, React client components, Node API Route Handlers and static assets. Real URL paths identify views. TanStack Query handles REST state and coalesced SSE invalidations. CSS tokens provide themes, with a local font. Articles, quiz questions and gallery records are generated from original source files; article pages receive server-loaded data and metadata.

`app/` defines the routes. `components/WorkspaceShell.tsx` holds navigation, theme and the workspace sign-in boundary. Private job data is always authorized in `server/api.ts`; hiding a client view is never the authorization mechanism. `app/api/**/route.ts` exports only supported methods and delegates to shared request controllers.

`instrumentation.ts` initializes one process-wide runtime from `server/runtime.ts`. The runtime owns SQLite, the crawler, bounded rate-limit state and live connections. It survives development module reloads, preventing duplicate workers. Restart development after changing runtime/crawler code so that instance receives the changes. Build workers do not initialize a database.

`scripts/start.mjs` uses Next's custom-server API. Next owns all routing and rendering; the host adds trusted socket identity and graceful shutdown. It overwrites client-supplied identity headers, stops accepting connections, closes SSE, aborts crawler requests, waits for durable queue updates and closes SQLite before exiting. This requires a persistent Node process and one replica, and intentionally does not use Next standalone output or serverless deployment.

`proxy.ts` supplies unique script nonces and CSP headers. The root layout reads request headers to ensure dynamic rendering. Public content avoids a loading boundary that would hide streamed HTML without JavaScript; job routes retain loading UI. Only `/legacy/` gets the broader policy needed by the original inline scripts and CDN resources. The repository root, database, environment and server source are never public document roots.

## Persistent state

`jobs` records configuration/lifecycle. `pages` records queue status, attempts, extraction and timing/errors, with a unique `(jobId,url)` constraint. A page and its discovered children commit together. One job runs at a time; its page requests run concurrently up to a configured limit. Jobs are FIFO.

```text
queued → running → completed / failed
queued / running → paused → queued
queued / running / paused → stopped
completed / failed / stopped → queued (retry failed pages)
running at interruption → paused after restart
fetching at interruption → queued after restart
```

Stopped/paused jobs retain records. Stop is not resumable; pause is. Retries retain successes and requeue failures. Queued jobs restart automatically; interrupted running jobs require explicit resume. Jobs may complete with partial failures/blocks/skips; the UI exposes that distinction.

## Fetch pipeline

1. Validate HTTP(S), port, credentials, URL length and host/path scope.
2. Fetch robots through the same guarded transport; require usable policy. Check redirect target policies too.
3. Serialize request admission through a rate gate with spacing, robots delay and bounded Retry-After cooldowns.
4. Resolve all addresses; reject if any is non-public. Handle alternative IPv4 encodings and mapped IPv6.
5. Pin the checked IP in the socket lookup, disable automatic address-family selection, preserve original TLS/SNI hostname, and send no user cookies/authentication.
6. Follow redirects manually, repeating validation before every request.
7. Read bounded responses under deadlines, including streaming gzip/deflate/Brotli with independent compressed/decompressed size caps. Parse HTML without executing JavaScript; extract bounded fields and enqueue in-scope children.
8. Retry transient network/HTTP failures with backoff, recording terminal errors without discarding unrelated work.

DNS is revalidated per request, not trusted from submission time. An outstanding system DNS promise cannot be canceled, but it cannot initiate a request after its deadline. Different redirect aliases may still yield equivalent content. URL query ordering is preserved.

## Security and operations

This is a single-owner workspace with an administrator key, signed HttpOnly session cookies, or bearer authentication. Public binding/production without a key fails startup. Host/Origin/Sec-Fetch-Site checks protect browser interactions. Arbitrary forwarded-header trust and CORS are not enabled. Credentials and request bodies are not logged. API exceptions use structured Pino logs. CSV cells are formula-safe. Extracted text is never inserted as active HTML.

One server process owns API, worker and SQLite. Multiple replicas require leases and shared scheduling first. Use TLS, egress filtering, persistent disk, host-level encryption and stopped-database backups. The app does not encrypt SQLite at rest or provide user accounts.

Limits: 100 jobs, 500 admitted URLs/job, six concurrent fetches, 2 MiB HTML responses, 150,000 text characters, 30 SSE connections. Disk retention is operator-managed through export/deletion. SSE notifications are ephemeral invalidations; reconnect reads durable current state. Slow streams close, and streams expire after 30 minutes.

No JS-rendering, PDF extraction, authenticated crawling, arbitrary request headers, proxy bypass, LLM processing or recurring schedules. Per-origin robots state is rebuilt on resume; total attempts persist, with a fresh configured retry budget per processing run. Deploy with current Node 24 LTS; the tested local Node 22.13 runtime warns that SQLite is experimental.

Prioritize content hashes/freshness, owner quotas and explicit worker leases before distributed infrastructure.

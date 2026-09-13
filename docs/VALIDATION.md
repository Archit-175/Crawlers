# Next.js migration validation — 13 September 2026

Executed locally on Windows with Node **22.13.1**, npm **11.4.2**, Next.js **16.3.5**, and installed Google Chrome. This report describes the completed Next.js migration, not the previous Vite/Fastify build.

| Check                              | Executed outcome                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dependency installation / lockfile | Next.js and Pino installed; Vite, its React plugin, Fastify and its plugins removed; lockfile synchronized              |
| `npm run typecheck`                | Passed; Next route generation and strict TypeScript                                                                     |
| `npm run lint`                     | Passed                                                                                                                  |
| `npm test`                         | **76 passed, 0 failed, 0 skipped**                                                                                      |
| `npm run build`                    | Passed with Turbopack; all page and API routes compiled                                                                 |
| `npm run test:e2e`                 | **8 passed** using Chrome and the production Next.js build                                                              |
| axe-core                           | No WCAG 2 A/AA violations detected in tested overview, crawl dialog, gallery, and mobile dark atlas states              |
| `npm run test:next`                | Passed: real production Next host, public pages, protected API, temporary file-backed SQLite, SSE and graceful shutdown |
| `npm run test:dev`                 | Passed: real Next development compilation, same page/API/database/stream checks and clean exit                          |
| `npm audit --audit-level=high`     | **0 vulnerabilities** reported                                                                                          |
| Source-content import              | **29 forest articles, 8 quiz questions, 84 gallery records** preserved                                                  |
| Database migration                 | None; existing schema/path retained; tests use isolated databases                                                       |
| Docker / hosted CI                 | Configuration updated; Docker unavailable locally and hosted CI not executed                                            |

## Regression coverage

The 76 backend cases exercise private/reserved IPv4/IPv6 and alternate encodings, mixed DNS answers, URL normalization, protocols/ports/credentials, pinned sockets, redirect validation and loops, streaming limits, gzip decoding and expansion bombs, deadlines, cancellation, and safe HTML/XML parsing.

Crawler and persistence coverage includes duplicate links, depth/page/domain bounds, robots exclusion/unavailability, sitemap indexes, concurrency, request spacing, transient retries, failed/non-HTML/empty pages, pause/resume/stop, invalid transitions, failed-page retry and restart recovery in a temporary file-backed database.

API tests run the same controllers used by App Router. They cover authentication, signed cookies, Host/Origin checks, validation, persisted job execution, pagination/filtering/inspection, CSV/JSON exports, missing jobs, deletion cascades, SSRF rejection, SSE updates/cleanup, JSON byte limits and media types, rate-limit expiry/capacity, and resistance to spoofed forwarded/transport headers. Browser tests additionally exercise actual Next routing, method handling, file isolation and HTTP streaming.

## Browser checks

1. Public articles contain server-rendered content, correct metadata, Next assets and unique CSP nonces. Article sections remain visible with JavaScript disabled. Unknown routes return 404 and the old gallery URL redirects.
2. The native gallery displays the 84 imported records, supports search and a dismissible viewer, and passes the sampled accessibility check. Next Link navigation preserves an in-document marker, and deep article reloads work without hydration errors.
3. The real Next server rejects unauthenticated jobs and unsupported API methods, prevents downloads of source/config/database paths, serves the legacy archive, streams SSE, preserves login across reloads and signs out.
4. Workspace login, live connection, light/dark mode, guide dialog, Escape handling and overview accessibility.
5. Create a crawl, watch real fixture processing, search results, inspect metadata, download JSON and delete the job.
6. Reject a private URL from the creation form and verify dialog accessibility.
7. Search/read a preserved article, complete all eight quiz questions, review score and restart.
8. Mobile navigation at 390 × 844, no horizontal document overflow, atlas search and dark-mode accessibility.

Pagination is verified at the API layer; the browser fixture is smaller than a results page. Accessibility scans are sampled automated checks, not manual certification. Tests never seed the actual workspace with sample results. External source photographs can be unavailable; the gallery reports unavailable media instead of substituting fake content.

## Issues corrected during this migration

- Replaced SPA hash routing and client-only mounting with App Router pages, Next Link and server-loaded public content.
- Replaced Fastify with native Request/Response controllers exposed by Next Node Route Handlers.
- Added per-request CSP nonces so Next hydration scripts work without allowing arbitrary inline production scripts.
- Moved the shared loading boundary to job routes after a no-JavaScript browser test found that it hid streamed article content.
- Scoped the form-error test to its dialog because Next has its own accessible route announcement.
- Adjusted environment input typing for Next's augmented Node environment declarations.
- Added an explicit post-cleanup exit in the smoke CLI because Next development tooling retained handles after its public close API resolved. The application signal handler likewise exits only after durable shutdown.

## Operational limits

The deployment needs one long-lived Node instance and persistent disk; it is not an ephemeral serverless or static-export target. Use `npm start` so crawler recovery, socket identity and shutdown hooks are installed. Docker/Compose, TLS proxy/SSE buffering, backups and restore still need verification on the deployment host. Local Node 22.13 prints an experimental SQLite warning; the Docker target is Node 24.

The previous upgrade's live Python.org smoke successfully extracted one HTTP 200 page; its Example.com attempt timed out. Those external-network results were not rerun during this framework migration. Migration checks use deterministic crawler fixtures and the real local HTTP transport test server.

The old weather credential remains in historical Git commits and must be revoked at the provider before re-enabling weather. No provider account or external application data was changed. Original content facts, external media/services, multi-user isolation, distributed workers, load testing and independent security review remain separate work.

Updated screenshots are in `docs/screenshots/`; full browser reports/traces are generated under ignored `playwright-report/` and `test-results/` directories.

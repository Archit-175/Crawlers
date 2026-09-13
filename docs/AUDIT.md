# Source audit — 13 September 2026

Initial checkout: clean at `b1320ea`. Inspection covered all source directories, 39 HTML documents and their inline scripts/headings/resources, every first-party JS module, representative shared/page styles, bundled libraries, original assets and documentation. No package/lockfile, server, database schema, migrations, environment template, tests, CI or Docker configuration existed.

## Existing feature inventory

| Feature          | Source                                   | Inputs → outputs                      | Findings/treatment                                                                |
| ---------------- | ---------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| Landing/parallax | `index.html`, root CSS, `parallex/`      | Scroll → layered forest presentation  | Retained in compatibility build                                                   |
| World map        | Inline SVG, `map.js`                     | Country selection → tour              | Seven countries; original map retained                                            |
| Tours            | `Country/*/*.html`, shared styles/JS     | Slide controls → overview/article     | Fixed undefined slider index                                                      |
| Forest articles  | 29 forest HTML files                     | Navigation → sections/images          | Imported source sections to searchable atlas and reader; originals retained       |
| Autocomplete     | `search-box.js`                          | Static keyword → legacy URL           | Trailing whitespace and limited states; modern atlas has search/country filtering |
| Weather          | `Country/weather.js`, inline coordinates | Coordinates → OpenWeather             | Embedded credential removed; optional server proxy and honest unavailable state   |
| Quiz             | `Quiz/`                                  | Eight choices → score/restart         | Original questions retained, modern accessible feedback/review added              |
| Gallery          | `Gallary/`                               | Click/arrows → forest/wildlife images | 84 photographs imported to a native gallery; source retained at `/legacy/`        |
| Blog             | External `crawlers-blogs.vercel.app`     | Navigation → separate service         | No local submission/storage backend; link preserved                               |
| Careers          | External `forestry-jobs.vercel.app`      | Navigation → separate service         | No local job backend; link preserved                                              |
| Planting         | External `plantree-server.vercel.app`    | Navigation → separate service         | No local transactions or planting backend; link preserved                         |
| Loading          | `loading.js`, inline preloaders          | Window/image load → content reveal    | Added five-second loader fallback and image-error callbacks                       |

## Features absent from original source

No URL crawler, recursive queue, concurrency control, robots/sitemap handling, crawl normalization/deduplication, persistence, exports, authentication, live events, AI/RAG, background processing or crawl analytics. MongoDB/NodeMailer are claimed by the old README but not implemented in this checkout. There is no accessible old database to migrate.

## Decisions and risks

- Preserve forestry purpose, team credits and source material. Add the requested web research capabilities as a coherent workspace.
- Following the explicit Next.js migration request, use Next.js 16 App Router for both pages and API, preserving bounded HTTP/Cheerio crawling and SQLite. Remove Vite and Fastify; no database migration, browser scraper, Redis, vector database or decorative AI is needed.
- Keep API, data access, security, network transport, extraction and scheduling in separate modules with shared configuration types.
- New SSRF surface is guarded at every request: public DNS-only, pinned sockets, manual redirects, scope enforcement and resource bounds. No production bypass switch exists.
- Remove the exposed weather credential from current source; revoke/rotate at the provider because Git history remains unchanged.
- Seven local case/whitespace resource mismatches fixed for Linux hosting. Added image error completion to all 29 article preloaders.
- Modern UI renders article/crawled content as text, provides working states, and reads real persisted metrics. No sample jobs are seeded.
- Legacy compatibility pages retain duplicated styles, older bundled libraries, placeholder links, fragile external media and historical content errors. The modern workspace does not depend on legacy JS. Copied country weather coordinates and some article headings deserve editorial review; no invented fact corrections were applied.

The upgrade changes no external blog, job, planting or storage service and performs no destructive data migration. See the architecture and validation reports for operational limits and evidence.

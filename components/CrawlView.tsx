'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import type { Job, Page } from '../shared/types';
import { api, date, number } from './api';
import { Badge, ErrorBox, Loading, Modal } from './components';
export function CrawlView({ id }: { id: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('url');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    setOffset(0);
  }, [search, status, id]);
  const job = useQuery({
    queryKey: ['job', id],
    queryFn: () => api<Job>(`/jobs/${id}`),
    refetchInterval: 15000,
  });
  const pages = useQuery({
    queryKey: ['pages', id, search, status, sort, offset],
    queryFn: () =>
      api<{ items: Page[]; total: number }>(
        `/jobs/${id}/pages?${new URLSearchParams({ search, status, sort, offset: String(offset) })}`,
      ),
    refetchInterval: 15000,
  });
  const control = useMutation({
    mutationFn: (action: string) =>
      api(`/jobs/${id}/control`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/jobs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries();
      router.push('/jobs');
    },
  });
  if (job.isPending) return <Loading />;
  if (job.error) return <ErrorBox error={job.error} />;
  const j = job.data;
  const processed = j.discovered - j.queued;
  const progress = j.discovered ? Math.round((processed / j.discovered) * 100) : 0;
  return (
    <>
      <Link href="/jobs" className="back">
        <ArrowLeft size={15} />
        All crawl jobs
      </Link>
      <div className="page-title">
        <div>
          <span className="eyebrow">CRAWL DETAILS</span>
          <h1>{j.name}</h1>
          <a href={j.url} target="_blank" rel="noreferrer" className="muted source-url">
            {j.url}
            <ArrowUpRight size={14} />
          </a>
        </div>
        <Badge status={j.status} />
      </div>
      <div className="control-bar">
        <div className="actions">
          {['running', 'queued'].includes(j.status) && (
            <button
              className="button"
              disabled={control.isPending}
              onClick={() => control.mutate('pause')}
            >
              <Pause size={15} />
              Pause
            </button>
          )}
          {j.status === 'paused' && (
            <button
              className="button primary"
              disabled={control.isPending}
              onClick={() => control.mutate('resume')}
            >
              <Play size={15} />
              Resume
            </button>
          )}
          {['running', 'queued', 'paused'].includes(j.status) && (
            <button
              className="button"
              disabled={control.isPending}
              onClick={() => control.mutate('stop')}
            >
              <Square size={14} />
              Stop
            </button>
          )}
          {['completed', 'failed', 'stopped'].includes(j.status) && j.failed > 0 && (
            <button
              className="button"
              disabled={control.isPending}
              onClick={() => control.mutate('retry')}
            >
              <RotateCcw size={15} />
              Retry failed pages
            </button>
          )}
          {!['running', 'queued'].includes(j.status) && (
            <button
              className="icon-button danger"
              aria-label="Delete crawl"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
        <div className="actions">
          <a className="button" href={`/api/jobs/${id}/export?format=csv`} download>
            <Download size={15} />
            CSV
          </a>
          <a className="button" href={`/api/jobs/${id}/export?format=json`} download>
            <Download size={15} />
            JSON
          </a>
        </div>
      </div>
      <ErrorBox error={control.error} />
      {j.error && (
        <div className="error" role="alert">
          {j.error}
        </div>
      )}
      <div className="metrics">
        {[
          { label: 'Pages collected', value: j.crawled },
          { label: 'URLs discovered', value: j.discovered },
          { label: 'In queue / fetching', value: j.queued },
          { label: 'Failed / blocked', value: `${j.failed} / ${j.blocked}` },
        ].map((m) => (
          <div className="metric" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
      <section className="panel progress-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Discovery progress <span className="muted">{progress}%</span>
            </h2>
            <p>
              {j.currentUrl ??
                (j.status === 'running'
                  ? 'Checking crawl policies and discovering pages…'
                  : `Last updated ${date(j.updatedAt)}`)}
            </p>
          </div>
          <span className="mono">
            {processed} / {j.discovered} processed
          </span>
        </div>
        <progress
          value={processed}
          max={Math.max(1, j.discovered)}
          aria-label="Processed discovered pages"
        />
        <div className="configuration">
          <span>
            Depth <b>{j.config.maxDepth}</b>
          </span>
          <span>
            Limit <b>{j.config.maxPages} pages</b>
          </span>
          <span>
            Concurrency <b>{j.config.concurrency}</b>
          </span>
          <span>
            Spacing <b>{j.config.delayMs} ms</b>
          </span>
          <span>
            Response avg. <b>{j.averageMs} ms</b>
          </span>
          <span>
            Started <b>{date(j.startedAt)}</b>
          </span>
          <span>
            Finished <b>{date(j.finishedAt)}</b>
          </span>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Results explorer</h2>
            <p>Inspect extracted content and trace every request.</p>
          </div>
        </div>
        <div className="toolbar">
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Search pages"
              placeholder="Search URL or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter page status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {['', 'success', 'failed', 'blocked', 'skipped', 'queued', 'fetching'].map((s) => (
              <option key={s} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
          <select aria-label="Sort pages" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="url">Discovery order</option>
            <option value="title">Title</option>
            <option value="response">Slowest first</option>
          </select>
        </div>
        <ErrorBox error={pages.error} />
        {pages.isPending ? (
          <Loading />
        ) : pages.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Page / URL</th>
                  <th>Status</th>
                  <th>HTTP</th>
                  <th>Words</th>
                  <th>Response</th>
                  <th>Depth</th>
                </tr>
              </thead>
              <tbody>
                {pages.data.items.map((page) => (
                  <tr key={page.id}>
                    <td>
                      <button className="page-cell" onClick={() => setSelected(page.id)}>
                        <strong>{page.title || new URL(page.url).pathname}</strong>
                        <small>{page.url}</small>
                      </button>
                    </td>
                    <td>
                      <Badge status={page.status} />
                    </td>
                    <td className="mono">{page.statusCode ?? '—'}</td>
                    <td className="mono">{number(page.wordCount)}</td>
                    <td className="mono nowrap">
                      {page.responseMs == null ? '—' : `${page.responseMs} ms`}
                    </td>
                    <td className="mono">{page.depth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <Search size={27} />
            <h3>No pages to show yet</h3>
            <p>
              {search || status
                ? 'Try another filter.'
                : 'Results will appear as the crawler processes discovered URLs.'}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {pages.data?.total
              ? `${offset + 1}–${Math.min(offset + 25, pages.data.total)} of ${pages.data.total} pages`
              : '0 pages'}
          </span>
          <div className="actions">
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={offset === 0}
              onClick={() => setOffset(offset - 25)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={offset + 25 >= (pages.data?.total ?? 0)}
              onClick={() => setOffset(offset + 25)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {selected !== null && (
        <PageInspector jobId={id} id={selected} onClose={() => setSelected(null)} />
      )}
      {deleting && (
        <Modal title="Delete this crawl?" onClose={() => setDeleting(false)}>
          <p>
            This removes this crawl and its collected pages from the workspace. Export anything you
            want to keep first.
          </p>
          <ErrorBox error={remove.error} />
          <div className="modal-actions">
            <button className="button" onClick={() => setDeleting(false)}>
              Keep crawl
            </button>
            <button
              className="button danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete crawl
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function PageInspector({ jobId, id, onClose }: { jobId: string; id: number; onClose: () => void }) {
  const page = useQuery({
    queryKey: ['page', jobId, id],
    queryFn: () => api<Page>(`/jobs/${jobId}/pages/${id}`),
  });
  const [tab, setTab] = useState('Content');
  return (
    <Modal title="Page inspection" onClose={onClose} wide>
      {page.isPending ? (
        <Loading />
      ) : page.error ? (
        <ErrorBox error={page.error} />
      ) : (
        <>
          <a href={page.data.url} target="_blank" rel="noreferrer" className="source-url">
            {page.data.url}
            <ArrowUpRight size={15} />
          </a>
          <div className="inspector-meta">
            <Badge status={page.data.status} />
            <span>HTTP {page.data.statusCode ?? '—'}</span>
            <span>{page.data.responseMs ?? '—'} ms</span>
            <span>{page.data.attempts} attempts</span>
          </div>
          {page.data.error && <div className="error">{page.data.error}</div>}
          <div className="tabs" role="tablist" aria-label="Extracted data">
            {['Content', 'Metadata', 'Links', 'Images', 'Structured data'].map((name) => (
              <button
                role="tab"
                aria-selected={tab === name}
                className={tab === name ? 'active' : ''}
                key={name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="inspector-body" role="tabpanel">
            {!page.data.data ? (
              <p className="muted">No HTML content was extracted for this request.</p>
            ) : tab === 'Content' ? (
              <>
                <h3>{page.data.data.title || 'Untitled page'}</h3>
                <p className="extracted-text">
                  {page.data.data.text || 'This page has no extractable text.'}
                </p>
              </>
            ) : tab === 'Metadata' ? (
              <>
                <dl>
                  <dt>Description</dt>
                  <dd>{page.data.data.description || '—'}</dd>
                  <dt>Final URL</dt>
                  <dd>{page.data.finalUrl}</dd>
                  <dt>Canonical</dt>
                  <dd>{page.data.data.canonical || '—'}</dd>
                  <dt>Content type</dt>
                  <dd>{page.data.contentType}</dd>
                  <dt>Language</dt>
                  <dd>{page.data.data.language || '—'}</dd>
                  <dt>Word count</dt>
                  <dd>{page.data.wordCount}</dd>
                </dl>
                <h3>Headings</h3>
                {page.data.data.headings.map((h, i) => (
                  <p key={i}>
                    <code>{h.level}</code> {h.text}
                  </p>
                ))}
              </>
            ) : tab === 'Links' ? (
              <ul className="link-list">
                {page.data.data.links.map((link) => (
                  <li key={link}>
                    <a href={link} target="_blank" rel="noreferrer">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            ) : tab === 'Images' ? (
              <ul className="link-list">
                {page.data.data.images.map((image, i) => (
                  <li key={i}>
                    <strong>{image.alt || 'No alt text'}</strong>
                    <a href={image.url} target="_blank" rel="noreferrer">
                      {image.url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <pre>{JSON.stringify(page.data.data.structuredData, null, 2)}</pre>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Plus, Globe2, ShieldCheck, ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, date, number } from './api';
import type { Job } from '../shared/types';

export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {status}
    </span>
  );
}
export function ErrorBox({ error }: { error: Error | null }) {
  return error ? (
    <div className="error" role="alert">
      {error.message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading workspace…
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previous = document.activeElement as HTMLElement;
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">WEB WONDERS / WORKSPACE</span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function NewCrawl({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const client = useQueryClient();
  const [advanced, setAdvanced] = useState(false);
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api<Job>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (job) => {
      void client.invalidateQueries({ queryKey: ['jobs'] });
      onCreated(job.id);
      onClose();
    },
  });
  return (
    <Modal title="Start a new crawl" onClose={onClose}>
      <p className="muted">
        Give your research a starting point. We’ll discover pages and extract their content.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutation.mutate({
            url: form.get('url'),
            name: form.get('name'),
            maxPages: Number(form.get('maxPages')),
            maxDepth: Number(form.get('maxDepth')),
            concurrency: Number(form.get('concurrency') ?? 3),
            delayMs: Number(form.get('delayMs') ?? 750),
            timeoutMs: Number(form.get('timeoutMs') ?? 10000),
            retries: Number(form.get('retries') ?? 2),
            pathPrefix: form.get('pathPrefix') ?? '',
            useSitemap: form.get('useSitemap') === 'on',
          });
        }}
      >
        <label>
          Starting URL
          <input
            name="url"
            type="url"
            placeholder="https://example.org"
            required
            autoFocus
            maxLength={2048}
          />
        </label>
        <label>
          Crawl name <span className="muted">optional</span>
          <input name="name" placeholder="Forest conservation research" maxLength={80} />
        </label>
        <div className="form-grid">
          <label>
            Page limit
            <input name="maxPages" type="number" min="1" max="500" defaultValue="50" required />
          </label>
          <label>
            Maximum depth
            <input name="maxDepth" type="number" min="0" max="5" defaultValue="2" required />
          </label>
        </div>
        <label className="check">
          <input name="useSitemap" type="checkbox" /> Discover pages from sitemaps
        </label>
        <button
          className="text-button"
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          {advanced ? '−' : '+'} Advanced configuration
        </button>
        {advanced && (
          <div className="advanced">
            <div className="form-grid">
              <label>
                Concurrency
                <input name="concurrency" type="number" min="1" max="6" defaultValue="3" required />
              </label>
              <label>
                Request spacing (ms)
                <input
                  name="delayMs"
                  type="number"
                  min="200"
                  max="10000"
                  defaultValue="750"
                  required
                />
              </label>
              <label>
                Timeout (ms)
                <input
                  name="timeoutMs"
                  type="number"
                  min="1000"
                  max="30000"
                  defaultValue="10000"
                  required
                />
              </label>
              <label>
                Retries
                <input name="retries" type="number" min="0" max="3" defaultValue="2" required />
              </label>
            </div>
            <label>
              Allowed path prefix
              <input name="pathPrefix" placeholder="/research/" maxLength={200} />
            </label>
          </div>
        )}
        <div className="notice">
          <ShieldCheck size={19} />
          <span>
            Public web only. Crawls stay on the starting hostname and respect robots.txt. Up to 500
            pages per job.
          </span>
        </div>
        <ErrorBox error={mutation.error} />
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}{' '}
            {mutation.isPending ? 'Validating host…' : 'Start crawl'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function JobTable({ jobs }: { jobs: Job[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Crawl / source</th>
            <th>Status</th>
            <th>Pages</th>
            <th>Response</th>
            <th>Created</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>
                <Link href={`/jobs/${job.id}`} className="source">
                  <span className="source-icon">
                    <Globe2 size={18} />
                  </span>
                  <span>
                    <strong>{job.name}</strong>
                    <small>{new URL(job.url).hostname}</small>
                  </span>
                </Link>
              </td>
              <td>
                <Badge status={job.status} />
              </td>
              <td className="mono">
                {number(job.crawled)} <span className="muted">/ {number(job.discovered)}</span>
              </td>
              <td className="mono">{job.averageMs ? `${number(job.averageMs)} ms` : '—'}</td>
              <td className="muted nowrap">{date(job.createdAt)}</td>
              <td>
                <Link
                  className="icon-button"
                  href={`/jobs/${job.id}`}
                  aria-label={`Open ${job.name}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

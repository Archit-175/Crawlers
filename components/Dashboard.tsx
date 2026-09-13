'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Files,
  Globe2,
  Plus,
  Search,
  Sprout,
  Timer,
  Workflow,
} from 'lucide-react';
import type { Job } from '../shared/types';
import { number } from './api';
import { JobTable } from './components';
export function Dashboard({
  jobs,
  onNew,
  history = false,
}: {
  jobs: Job[];
  onNew: () => void;
  history?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const crawled = jobs.reduce((n, j) => n + j.crawled, 0),
    failed = jobs.reduce((n, j) => n + j.failed, 0);
  const metrics = [
    {
      name: 'Total crawl jobs',
      value: jobs.length,
      icon: Workflow,
      sub: `${jobs.filter((j) => j.status === 'running').length} running now`,
    },
    {
      name: 'Pages collected',
      value: number(crawled),
      icon: Files,
      sub: `${number(jobs.reduce((n, j) => n + j.discovered, 0))} URLs discovered`,
    },
    {
      name: 'Success rate',
      value: crawled + failed ? `${Math.round((crawled / (crawled + failed)) * 100)}%` : '—',
      icon: CheckCheck,
      sub: `${failed} failed requests`,
    },
    {
      name: 'Avg. response time',
      value: crawled
        ? `${number(Math.round(jobs.reduce((n, j) => n + j.averageMs * j.crawled, 0) / crawled))} ms`
        : '—',
      icon: Timer,
      sub: 'Across collected pages',
    },
  ];
  const shown = jobs.filter(
    (j) =>
      (filter === 'all' || j.status === filter) &&
      `${j.name} ${j.url}`.toLowerCase().includes(search.toLowerCase()),
  );
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return d;
  });
  const counts = days.map((d) =>
    jobs
      .filter((j) => new Date(j.createdAt).toDateString() === d.toDateString())
      .reduce((n, j) => n + j.crawled, 0),
  );
  const max = Math.max(1, ...counts);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR RESEARCH, CONNECTED</span>
          <h1>{history ? 'Crawl jobs' : 'Workspace overview'}</h1>
          <p>Discover the web. Understand the world.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          New crawl
        </button>
      </div>
      {!history && (
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-label">
              <span className="status-dot" /> WEB INTELLIGENCE, ROOTED IN CURIOSITY
            </div>
            <h2>
              A world of knowledge.
              <br />
              <span>Yours to explore.</span>
            </h2>
            <p>
              Turn public websites into structured research.
              <br />
              Every discovery starts with a single link.
            </p>
            <button className="button pale" onClick={onNew}>
              Create a crawl <ArrowUpRight size={17} />
            </button>
            <Link href="/forests" className="hero-link">
              Explore the forest atlas <ArrowRight size={15} />
            </Link>
          </div>
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit o1" />
            <div className="orbit o2" />
            <div className="orbit o3" />
            <div className="orbit o4" />
            <div className="orbit o5" />
            <div className="orbit o6" />
            <span className="orbit-center">
              <Sprout size={49} strokeWidth={1.2} />
            </span>
            <span className="orbit-node n1">
              <Globe2 size={19} />
            </span>
            <span className="orbit-node n2">
              <Files size={17} />
            </span>
            <span className="orbit-caption">EXPLORE · EXTRACT · UNDERSTAND</span>
          </div>
        </div>
      )}
      <div className="metrics">
        {metrics.map((m) => (
          <div className="metric" key={m.name}>
            <div>
              <span>{m.name}</span>
              <m.icon size={17} />
            </div>
            <strong>{m.value}</strong>
            <small>{m.sub}</small>
          </div>
        ))}
      </div>
      {!history && (
        <div className="overview-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Crawl activity</h2>
                <p>Pages collected, grouped by job creation date</p>
              </div>
              <span className="chip">Last 14 days</span>
            </div>
            <div
              className="chart"
              role="img"
              aria-label={`Pages collected in jobs created in the last 14 days: ${counts.join(', ')}`}
            >
              <div className="chart-grid">
                <span>{number(max)}</span>
                <span>{Math.round(max / 2)}</span>
                <span>0</span>
              </div>
              <div className="bars">
                {counts.map((n, i) => (
                  <div key={i} className="bar-column">
                    <div
                      className="bar"
                      style={{ height: n ? `${(n / max) * 100}%` : '2px' }}
                      title={`${days[i].toLocaleDateString()}: ${n} pages`}
                    />
                    <span>
                      {i % 3 === 0
                        ? days[i].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
              {!crawled && (
                <div className="chart-empty">
                  <Activity size={19} />
                  <span>Your activity will appear here after your first crawl.</span>
                </div>
              )}
            </div>
          </section>
          <section className="atlas-callout">
            <div className="atlas-top">
              <Sprout size={23} />
              <span>THE ORIGINAL CRAWLERS</span>
            </div>
            <h2>
              Stay curious.
              <br />
              Go a little greener.
            </h2>
            <p>
              Explore 29 forest stories across seven countries, from the Amazon to the Western
              Ghats.
            </p>
            <Link href="/forests">
              Open the forest atlas <ArrowUpRight size={17} />
            </Link>
            <span className="atlas-bottom">
              7 COUNTRIES <i /> 29 FORESTS
            </span>
          </section>
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {history ? 'All crawl jobs' : 'Recent crawls'}{' '}
              <span className="count">{jobs.length}</span>
            </h2>
            <p>
              {history
                ? 'Your complete research history.'
                : 'Pick up where your curiosity left off.'}
            </p>
          </div>
          {!history && (
            <Link href="/jobs" className="text-link">
              View all <ArrowRight size={15} />
            </Link>
          )}
        </div>
        {history && (
          <div className="toolbar">
            <div className="search">
              <Search size={17} />
              <input
                aria-label="Search crawls"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or URL…"
              />
            </div>
            <select
              aria-label="Filter crawl status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {['all', 'running', 'queued', 'paused', 'completed', 'failed', 'stopped'].map((s) => (
                <option key={s} value={s}>
                  {s === 'all' ? 'All statuses' : s}
                </option>
              ))}
            </select>
          </div>
        )}
        {shown.length ? (
          <JobTable jobs={history ? shown : shown.slice(0, 5)} />
        ) : (
          <div className="empty">
            <span className="empty-icon">
              <Workflow size={28} strokeWidth={1.3} />
            </span>
            <h3>{jobs.length ? 'No matching crawls' : 'Your next discovery starts here'}</h3>
            <p>
              {jobs.length
                ? 'Try a different search or status filter.'
                : 'Add a website to collect pages, discover links, and build your research library.'}
            </p>
            {!jobs.length && (
              <button className="button" onClick={onNew}>
                <Plus size={16} />
                Create your first crawl
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

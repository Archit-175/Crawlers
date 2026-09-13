'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Compass,
  ExternalLink,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  Plus,
  ShieldCheck,
  Sprout,
  Sun,
  Workflow,
} from 'lucide-react';
import type { Job } from '../shared/types';
import { api } from './api';
import { ErrorBox, Loading, Modal, NewCrawl } from './components';

const WorkspaceContext = createContext({ openNewCrawl: () => {} });
export const useWorkspace = () => useContext(WorkspaceContext);
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const route = usePathname();
  const router = useRouter();
  const cache = useQueryClient();
  const [create, setCreate] = useState(false);
  const [help, setHelp] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [live, setLive] = useState(false);
  const [theme, setTheme] = useState('light');
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<{ authenticated: boolean; required: boolean }>('/session'),
    refetchInterval: 60000,
  });
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api<{ items: Job[] }>('/jobs'),
    enabled: session.data?.authenticated === true,
    refetchInterval: 15000,
  });
  const logout = useMutation({
    mutationFn: () => api('/session', { method: 'DELETE' }),
    onSuccess: () => {
      cache.clear();
      router.push('/');
    },
  });
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? 'light');
    if (window.location.hash.startsWith('#/')) router.replace(window.location.hash.slice(1));
  }, [router]);
  useEffect(() => {
    setMobile(false);
  }, [route]);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('crawlers-theme', next);
    } catch {
      /* Storage may be disabled. */
    }
  }
  useEffect(() => {
    if (!session.data?.authenticated) return;
    const stream = new EventSource('/api/events');
    stream.onopen = () => setLive(true);
    stream.onerror = () => {
      setLive(false);
      void cache.invalidateQueries({ queryKey: ['session'] });
    };
    stream.addEventListener('update', () => {
      void cache.invalidateQueries({ queryKey: ['jobs'] });
      void cache.invalidateQueries({ queryKey: ['job'] });
      void cache.invalidateQueries({ queryKey: ['pages'] });
    });
    return () => {
      stream.close();
      setLive(false);
    };
  }, [session.data?.authenticated, cache]);
  const active = route.startsWith('/forests')
    ? 'forests'
    : route === '/gallery'
      ? 'gallery'
      : route === '/quiz'
        ? 'quiz'
        : route.startsWith('/jobs')
          ? 'jobs'
          : 'overview';
  const navigation = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '/' },
    { id: 'jobs', label: 'Crawl jobs', icon: Workflow, href: '/jobs' },
    { id: 'forests', label: 'Forest atlas', icon: Compass, href: '/forests' },
    { id: 'gallery', label: 'Nature gallery', icon: Leaf, href: '/gallery' },
    { id: 'quiz', label: 'Knowledge quiz', icon: BookOpen, href: '/quiz' },
  ];
  const privateView = active === 'overview' || active === 'jobs';
  return (
    <WorkspaceContext.Provider value={{ openNewCrawl: () => setCreate(true) }}>
      <div className="app">
        <a
          className="skip-link"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('main')?.focus();
          }}
        >
          Skip to content
        </a>
        {mobile && (
          <button
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={`sidebar ${mobile ? 'open' : ''}`}>
          <Link className="brand" href="/">
            <span className="brand-icon">
              <Sprout size={25} />
            </span>
            <span>
              crawlers<span className="brand-sub">BY WEB WONDERS</span>
            </span>
          </Link>
          <div className="workspace-switch">
            <span className="workspace-avatar">W</span>
            <span>
              Research workspace<small>Explore with purpose</small>
            </span>
            <ChevronRight size={15} />
          </div>
          <span className="nav-label">WORKSPACE</span>
          <nav aria-label="Main navigation">
            {navigation.map((n) => (
              <Link
                className={active === n.id ? 'nav-item active' : 'nav-item'}
                aria-current={active === n.id ? 'page' : undefined}
                href={n.href}
                key={n.id}
              >
                <n.icon size={18} />
                {n.label}
                {n.id === 'jobs' && (
                  <span className="nav-count">{jobs.data?.items.length ?? 0}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-separator" />
          <span className="nav-label">FROM OUR ROOTS</span>
          <nav aria-label="Original project">
            <a
              className="nav-item"
              href="https://crawlers-blogs.vercel.app/"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen size={17} />
              Community stories
              <ExternalLink size={13} />
            </a>
            <a
              className="nav-item"
              href="https://forestry-jobs.vercel.app/"
              target="_blank"
              rel="noreferrer"
            >
              <Compass size={17} />
              Conservation careers
              <ExternalLink size={13} />
            </a>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <Sprout size={20} />
              <strong>
                Small discoveries.
                <br />A bigger perspective.
              </strong>
              <p>
                Built from a love of forests
                <br />
                and a curiosity for the web.
              </p>
              <a href="https://plantree-server.vercel.app" target="_blank" rel="noreferrer">
                Support reforestation
                <ArrowUpRight size={14} />
              </a>
            </div>
            <button className="nav-item" onClick={() => setHelp(true)}>
              <CircleHelp size={17} />
              Workspace guide
            </button>
            <div className="profile">
              <span>WW</span>
              <div>
                Web Wonders
                <small>{session.data?.required ? 'Private workspace' : 'Local workspace'}</small>
              </div>
              {session.data?.required && session.data.authenticated && (
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  onClick={() => logout.mutate()}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              <PanelLeftClose size={17} className="desktop-only" />
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{navigation.find((n) => n.id === active)?.label}</strong>
            </div>
            <div className="topbar-right">
              <span className={`connection ${live ? 'connected' : ''}`}>
                <i />
                {live
                  ? 'Live updates'
                  : session.data?.authenticated
                    ? 'Reconnecting…'
                    : 'Not connected'}
              </span>
              <button
                className="icon-button"
                aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                onClick={toggleTheme}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button
                className="icon-button"
                aria-label="Workspace guide"
                onClick={() => setHelp(true)}
              >
                <CircleHelp size={18} />
              </button>
              <span className="top-avatar">W</span>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {privateView && (session.isPending || session.error || !session.data?.authenticated) ? (
              session.isPending ? (
                <Loading />
              ) : session.error ? (
                <ErrorBox error={session.error} />
              ) : (
                <Login />
              )
            ) : (
              children
            )}
            <footer className="main-footer">
              <span>
                <Sprout size={14} /> WEB WONDERS — CRAWLERS
              </span>
              <span>Explore responsibly. Leave a lighter footprint.</span>
            </footer>
          </main>
        </div>
        {create && (
          <NewCrawl
            onClose={() => setCreate(false)}
            onCreated={(id) => {
              router.push(`/jobs/${id}`);
            }}
          />
        )}
        {help && (
          <Modal title="Your research workspace" onClose={() => setHelp(false)}>
            <div className="guide">
              <p>
                Crawlers connects the original forest exploration collection with a tool for
                researching public websites.
              </p>
              <h3>
                <Plus size={17} /> Create a crawl
              </h3>
              <p>
                Enter a public URL and choose limits. Jobs run one at a time, with concurrent
                requests within each job. Depth 0 collects only the starting page.
              </p>
              <h3>
                <ShieldCheck size={17} /> Crawl responsibly
              </h3>
              <p>
                Private networks and nonstandard ports are blocked. Crawls remain on the seed
                hostname, honor robots.txt, and space requests. Only crawl sites you are permitted
                to access.
              </p>
              <h3>Understand the results</h3>
              <p>
                Progress measures processed URLs out of URLs discovered so far; the denominator can
                grow. Blocked pages were rejected by policy. Skipped pages were not HTML. Open a
                page to inspect its content, links, headings, and errors.
              </p>
              <h3>Keep your research</h3>
              <p>
                Export JSON for full extracted data or CSV for a page summary. Pause to continue
                later; interrupted running jobs recover as paused after a restart.
              </p>
              <h3>Our roots</h3>
              <p>
                Forest articles and eight quiz questions come from the original Web Wonders project.
                The gallery is part of this workspace. Blog, careers, and planting links retain
                their original destinations.
              </p>
            </div>
          </Modal>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
function Login() {
  const cache = useQueryClient();
  const signIn = useMutation({
    mutationFn: (key: string) => api('/session', { method: 'POST', body: JSON.stringify({ key }) }),
    onSuccess: () => {
      void cache.invalidateQueries();
    },
  });
  return (
    <section className="login panel">
      <span className="brand-icon">
        <Sprout size={28} />
      </span>
      <h1>Welcome to Crawlers</h1>
      <p className="muted">Enter your workspace key to access crawl jobs and collected research.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn.mutate(String(new FormData(e.currentTarget).get('key')));
        }}
      >
        <label>
          Workspace key
          <input name="key" type="password" autoComplete="current-password" required autoFocus />
        </label>
        <ErrorBox error={signIn.error} />
        <button className="button primary" disabled={signIn.isPending}>
          Unlock workspace <ArrowUpRight size={17} />
        </button>
      </form>
    </section>
  );
}

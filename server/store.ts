import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CrawlConfig, Job, JobStatus, Page, Extracted, PageStatus } from '../shared/types';

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO schema_version VALUES (1);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL,
        config TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
        startedAt TEXT, finishedAt TEXT, error TEXT
      );
      CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY, jobId TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        url TEXT NOT NULL, finalUrl TEXT, depth INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
        statusCode INTEGER, contentType TEXT, responseMs INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT, title TEXT NOT NULL DEFAULT '', wordCount INTEGER NOT NULL DEFAULT 0,
        fetchedAt TEXT, data TEXT, UNIQUE(jobId,url)
      );
      CREATE INDEX IF NOT EXISTS pages_queue ON pages(jobId,status,depth,id);
      CREATE INDEX IF NOT EXISTS jobs_created ON jobs(createdAt DESC);`);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  recover() {
    this.db.exec(
      "UPDATE jobs SET status='paused', error='Interrupted by server restart; resume to continue.' WHERE status='running'; UPDATE pages SET status='queued' WHERE status='fetching';",
    );
  }
  create(config: CrawlConfig): Job {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO jobs(id,name,url,status,config,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          id,
          config.name || new URL(config.url).hostname,
          config.url,
          'queued',
          JSON.stringify(config),
          now,
          now,
        );
      this.enqueue(id, config.url, 0, config.maxPages);
    });
    return this.job(id)!;
  }
  jobs(): Job[] {
    return this.db
      .prepare('SELECT id FROM jobs ORDER BY createdAt DESC')
      .all()
      .map((row) => this.job(String(row.id))!);
  }
  job(id: string): Job | undefined {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id);
    if (!row) return undefined;
    const counts = this.db
      .prepare(
        `SELECT COUNT(*) AS discovered,
      COALESCE(SUM(status='success'),0) AS crawled, COALESCE(SUM(status='failed'),0) AS failed,
      COALESCE(SUM(status='blocked'),0) AS blocked, COALESCE(SUM(status IN ('queued','fetching')),0) AS queued,
      COALESCE(ROUND(AVG(responseMs)),0) AS averageMs FROM pages WHERE jobId=?`,
      )
      .get(id)!;
    const current = this.db
      .prepare("SELECT url FROM pages WHERE jobId=? AND status='fetching' ORDER BY id LIMIT 1")
      .get(id);
    return {
      ...row,
      ...counts,
      config: JSON.parse(String(row.config)),
      currentUrl: current?.url ?? null,
    } as unknown as Job;
  }
  status(id: string, status: JobStatus, error: string | null = null) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE jobs SET status=?, error=?, updatedAt=?, startedAt=CASE WHEN ?='running' THEN COALESCE(startedAt,?) ELSE startedAt END,
      finishedAt=CASE WHEN ? IN ('completed','failed','stopped') THEN ? ELSE NULL END WHERE id=?`,
      )
      .run(status, error, now, status, now, status, now, id);
  }
  enqueue(id: string, url: string, depth: number, max: number) {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO pages(jobId,url,depth) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM pages WHERE jobId=?) < ?',
      )
      .run(id, url, depth, id, max);
  }
  claim(id: string): Page | undefined {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM pages WHERE jobId=? AND status='queued' ORDER BY depth,id LIMIT 1")
        .get(id);
      if (!row) return undefined;
      this.db.prepare("UPDATE pages SET status='fetching' WHERE id=?").run(row.id);
      return { ...row, status: 'fetching', data: null } as unknown as Page;
    });
  }
  attempt(id: number) {
    this.db.prepare('UPDATE pages SET attempts=attempts+1 WHERE id=?').run(id);
  }
  finish(
    id: number,
    status: PageStatus,
    result: {
      url?: string;
      status?: number;
      contentType?: string;
      responseMs?: number;
      data?: Extracted;
      error?: string;
    } = {},
  ) {
    this.db
      .prepare(
        'UPDATE pages SET status=?,finalUrl=?,statusCode=?,contentType=?,responseMs=?,data=?,title=?,wordCount=?,error=?,fetchedAt=? WHERE id=?',
      )
      .run(
        status,
        result.url ?? null,
        result.status ?? null,
        result.contentType ?? null,
        result.responseMs ?? null,
        result.data ? JSON.stringify(result.data) : null,
        result.data?.title ?? '',
        result.data?.wordCount ?? 0,
        result.error ?? null,
        status === 'queued' ? null : new Date().toISOString(),
        id,
      );
  }
  pages(
    id: string,
    options: {
      search?: string;
      status?: string;
      offset?: number;
      limit?: number;
      sort?: string;
    } = {},
  ) {
    const search = `%${(options.search ?? '').replace(/[!%_]/g, '!$&')}%`;
    const where =
      "jobId=? AND (url LIKE ? ESCAPE '!' OR title LIKE ? ESCAPE '!') AND (?='' OR status=?)";
    const args = [id, search, search, options.status ?? '', options.status ?? ''];
    const sort =
      options.sort === 'response'
        ? 'responseMs DESC,id'
        : options.sort === 'title'
          ? 'title,id'
          : 'id';
    const columns =
      'id,jobId,url,finalUrl,depth,status,statusCode,contentType,responseMs,attempts,error,title,wordCount,fetchedAt';
    const items = this.db
      .prepare(`SELECT ${columns} FROM pages WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .all(...args, options.limit ?? 25, options.offset ?? 0) as unknown as Page[];
    const total = Number(
      this.db.prepare(`SELECT COUNT(*) AS n FROM pages WHERE ${where}`).get(...args)!.n,
    );
    return { items, total };
  }
  page(jobId: string, id: number): Page | undefined {
    const row = this.db.prepare('SELECT * FROM pages WHERE jobId=? AND id=?').get(jobId, id);
    return row
      ? ({ ...row, data: row.data ? JSON.parse(String(row.data)) : null } as unknown as Page)
      : undefined;
  }
  retry(id: string) {
    this.db
      .prepare("UPDATE pages SET status='queued',error=NULL WHERE jobId=? AND status='failed'")
      .run(id);
    this.status(id, 'queued');
  }
  delete(id: string) {
    this.db.prepare('DELETE FROM jobs WHERE id=?').run(id);
  }
  close() {
    this.db.close();
  }
}

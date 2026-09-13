import { z } from 'zod';
export const crawlConfigSchema = z
  .object({
    url: z.string().trim().min(1).max(2048),
    name: z.string().trim().max(80).default(''),
    maxPages: z.number().int().min(1).max(500).default(50),
    maxDepth: z.number().int().min(0).max(5).default(2),
    concurrency: z.number().int().min(1).max(6).default(3),
    delayMs: z.number().int().min(200).max(10000).default(750),
    timeoutMs: z.number().int().min(1000).max(30000).default(10000),
    retries: z.number().int().min(0).max(3).default(2),
    useSitemap: z.boolean().default(false),
    pathPrefix: z.string().max(200).default(''),
  })
  .strict();
export type CrawlConfig = z.infer<typeof crawlConfigSchema>;
export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
export type PageStatus = 'queued' | 'fetching' | 'success' | 'failed' | 'blocked' | 'skipped';
export interface Job {
  id: string;
  name: string;
  url: string;
  status: JobStatus;
  config: CrawlConfig;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  discovered: number;
  crawled: number;
  failed: number;
  blocked: number;
  queued: number;
  averageMs: number;
  currentUrl: string | null;
}
export interface Extracted {
  title: string;
  description: string;
  headings: { level: string; text: string }[];
  text: string;
  links: string[];
  images: { url: string; alt: string }[];
  canonical: string | null;
  language: string;
  wordCount: number;
  structuredData: unknown[];
}
export interface Page {
  id: number;
  jobId: string;
  url: string;
  finalUrl: string | null;
  depth: number;
  status: PageStatus;
  statusCode: number | null;
  contentType: string | null;
  responseMs: number | null;
  attempts: number;
  error: string | null;
  title: string;
  wordCount: number;
  fetchedAt: string | null;
  data?: Extracted | null;
}
export interface Forest {
  id: string;
  title: string;
  country: string;
  subtitle: string;
  image: string;
  legacyUrl: string;
  sections: { title: string; text: string; image: string }[];
}
export interface Question {
  question: string;
  answer: string;
  options: string[];
}

export interface GalleryImage {
  id: string;
  title: string;
  url: string;
}
export interface LibraryData {
  forests: Forest[];
  questions: Question[];
  gallery: GalleryImage[];
}

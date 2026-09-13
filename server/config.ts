import { z } from 'zod';
const envSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.url().default('http://localhost:3001'),
  DATABASE_PATH: z.string().default('./data/crawlers.sqlite'),
  CRAWL_API_KEY: z.string().min(32).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OPENWEATHER_API_KEY: z.string().optional(),
});
export type Config = z.infer<typeof envSchema>;
export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  const config = parsed.data;
  if (
    (config.NODE_ENV === 'production' ||
      !['127.0.0.1', 'localhost', '::1'].includes(config.HOST)) &&
    !config.CRAWL_API_KEY
  )
    throw new Error(
      'CRAWL_API_KEY (at least 32 characters) is required for production or a public bind address.',
    );
  if (new URL(config.APP_ORIGIN).origin !== config.APP_ORIGIN)
    throw new Error('APP_ORIGIN must be an origin without a path or trailing slash.');
  return config;
}

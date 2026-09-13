import pino from 'pino';
import { Store } from './store';
import { Engine } from './crawler/engine';
import { readConfig, type Config } from './config';
import { resolvePublicUrl } from './crawler/security';

export class RateLimiter {
  private entries = new Map<string, { count: number; reset: number }>();
  take(key: string, limit: number, windowMs: number, now = Date.now()) {
    for (const [id, entry] of this.entries) if (entry.reset <= now) this.entries.delete(id);
    const entry = this.entries.get(key) ?? { count: 0, reset: now + windowMs };
    // Refuse excess identities instead of allowing an unbounded in-memory map.
    if (!this.entries.has(key) && this.entries.size >= 10000) return 60;
    entry.count++;
    this.entries.set(key, entry);
    return entry.count > limit ? Math.max(1, Math.ceil((entry.reset - now) / 1000)) : 0;
  }
}

export function createRuntime(
  options: {
    config?: Config;
    store?: Store;
    engine?: Engine;
    validateTarget?: typeof resolvePublicUrl;
  } = {},
) {
  const config = options.config ?? readConfig();
  const store = options.store ?? new Store(config.DATABASE_PATH);
  const engine = options.engine ?? new Engine(store);
  const log = pino({ level: config.NODE_ENV === 'test' ? 'silent' : config.LOG_LEVEL });
  const connections = new Set<() => void>();
  let closing = false;
  let shutdown: Promise<void> | undefined;
  return {
    config,
    store,
    engine,
    log,
    connections,
    limiter: new RateLimiter(),
    weatherCache: new Map<string, { at: number; value: unknown }>(),
    validateTarget: options.validateTarget ?? resolvePublicUrl,
    get closing() {
      return closing;
    },
    shutdown() {
      if (!shutdown) {
        closing = true;
        connections.forEach((close) => close());
        shutdown = engine.shutdown().then(() => {
          if (!options.store) store.close();
        });
      }
      return shutdown;
    },
  };
}
export type Runtime = ReturnType<typeof createRuntime>;
const state = globalThis as typeof globalThis & { __crawlersRuntime?: Runtime };
export function getRuntime(): Runtime {
  if (!state.__crawlersRuntime) {
    const runtime = createRuntime();
    runtime.store.recover();
    state.__crawlersRuntime = runtime;
    runtime.engine.kick();
  }
  return state.__crawlersRuntime;
}

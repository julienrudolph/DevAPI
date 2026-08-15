// In-memory, per-process idempotency cache (AGENTS.md 14). Bounded by TTL
// and a maximum entry count so a flood of distinct keys cannot grow this
// unboundedly; not shared across API replicas, matching the same scaling
// note as InMemoryExecutionLimiter.
export interface CachedResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyStoreOptions {
  ttlMs: number;
  maxEntries?: number;
  now?: () => number;
}

interface Entry {
  response: CachedResponse;
  expiresAt: number;
}

export interface IdempotencyStore {
  get(key: string): CachedResponse | undefined;
  set(key: string, response: CachedResponse): void;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, Entry>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: IdempotencyStoreOptions) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? 5_000;
  }

  get(key: string): CachedResponse | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.response;
  }

  set(key: string, response: CachedResponse): void {
    if (this.entries.size >= this.maxEntries) this.sweep();
    this.entries.set(key, { response, expiresAt: this.now() + this.ttlMs });
  }

  private sweep(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}

export function idempotencyKeyFromHeader(
  headerValue: string | string[] | undefined,
): string | undefined {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return undefined;
  return trimmed;
}

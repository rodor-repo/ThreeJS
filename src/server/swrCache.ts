type SwrCacheOptions = {
  maxEntries: number
  ttlMs: number
}

type CacheEntry<T> = {
  value: T
  updatedAt: number
  inflight?: Promise<void>
}

export class SwrCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private inflight = new Map<string, Promise<T>>()
  private maxEntries: number
  private ttlMs: number
  private isDev: boolean

  constructor(options: SwrCacheOptions) {
    this.maxEntries = options.maxEntries
    this.ttlMs = options.ttlMs
    this.isDev = process.env.NODE_ENV !== "production"
  }

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const entry = this.cache.get(key)

    if (entry) {
      this.touch(key, entry)
      if (now - entry.updatedAt <= this.ttlMs) {
        this.log("hit", key)
        return entry.value
      }

      if (!entry.inflight) {
        this.log("stale", key)
        entry.inflight = this.fetchAndSet(key, fetcher)
          .then(() => {
            const current = this.cache.get(key)
            if (current === entry) current.inflight = undefined
          })
          .catch(() => {
            const current = this.cache.get(key)
            if (current === entry) current.inflight = undefined
          })
      } else {
        this.log("stale-inflight", key)
      }

      return entry.value
    }

    const inFlight = this.inflight.get(key)
    if (inFlight) {
      this.log("coalesce", key)
      return inFlight
    }

    this.log("miss", key)
    const request = this.fetchAndSet(key, fetcher)
    this.inflight.set(key, request)
    try {
      return await request
    } finally {
      this.inflight.delete(key)
    }
  }

  private async fetchAndSet(key: string, fetcher: () => Promise<T>) {
    const value = await fetcher()
    this.set(key, value)
    return value
  }

  private set(key: string, value: T) {
    this.cache.delete(key)
    this.cache.set(key, { value, updatedAt: Date.now() })
    this.log("fill", key)
    this.evictIfNeeded()
  }

  clear() {
    this.cache.clear()
    this.inflight.clear()
  }

  private touch(key: string, entry: CacheEntry<T>) {
    this.cache.delete(key)
    this.cache.set(key, entry)
  }

  private evictIfNeeded() {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey === undefined) return
      this.cache.delete(oldestKey)
      this.log("evict", oldestKey)
    }
  }

  private log(
    event:
      | "hit"
      | "stale"
      | "stale-inflight"
      | "miss"
      | "coalesce"
      | "fill"
      | "evict",
    key: string
  ) {
    if (!this.isDev) return
    const prefix = "[swr]"
    const safeKey = key.length > 140 ? `${key.slice(0, 140)}...` : key
    const message = (() => {
      switch (event) {
        case "hit":
          return "hit (fresh) - good news"
        case "stale":
          return "stale - serving cached, refreshing"
        case "stale-inflight":
          return "stale - serving cached, refresh inflight"
        case "miss":
          return "miss - fetching"
        case "coalesce":
          return "coalesce - awaiting inflight"
        case "fill":
          return "fill - cache updated"
        case "evict":
          return "evict - LRU drop"
        default:
          return event
      }
    })()
    console.info(`${prefix} ${message} ${safeKey}`)
  }
}

const swrCaches = new Set<SwrCache<unknown>>()

export function createSwrCache<T>(options: SwrCacheOptions) {
  const cache = new SwrCache<T>(options)
  swrCaches.add(cache as SwrCache<unknown>)
  return cache
}

export function clearAllSwrCaches() {
  for (const cache of Array.from(swrCaches)) {
    cache.clear()
  }
}

export function stableStringify(value: unknown): string {
  if (value === null) return "null"
  const valueType = typeof value
  if (valueType === "undefined") return "null"
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  if (valueType === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

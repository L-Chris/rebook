export interface PromiseCacheEntry<T> {
    promise: Promise<T>
    created: boolean
}

export function getOrCreatePromise<K, T>(
    cache: Map<K, Promise<T>>,
    key: K,
    load: () => Promise<T>,
): PromiseCacheEntry<T> {
    const existing = cache.get(key)
    if (existing) return { promise: existing, created: false }

    const promise = Promise.resolve().then(load).finally(() => {
        if (cache.get(key) === promise) cache.delete(key)
    })
    cache.set(key, promise)
    return { promise, created: true }
}

export function getOrCreateCachedPromise<K, T>(
    cache: Map<K, Promise<T>>,
    key: K,
    load: () => T | Promise<T>,
): Promise<T> {
    const existing = cache.get(key)
    if (existing) return existing

    const promise = Promise.resolve().then(load)
    cache.set(key, promise)
    return promise
}

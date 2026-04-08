import type { StorageBackend, StorageCallback } from '../types.js'

export interface MemoryStorageBackend extends StorageBackend {
  readonly setAndNotify: (key: string, newValue: string | undefined) => void
}

export function createMemoryStorageBackend (): MemoryStorageBackend {
  const storage = new Map<string, string>()
  const subscriptions = new Map<string, Set<StorageCallback>>()

  const get: StorageBackend['get'] = async (key) => {
    return storage.get(key)
  }

  const set: StorageBackend['set'] = async (key, value) => {
    storage.set(key, value)
  }

  const subscribe: StorageBackend['subscribe'] = (key, callback) => {
    let keySubscribers = subscriptions.get(key)
    if (keySubscribers == null) {
      keySubscribers = new Set()
      subscriptions.set(key, keySubscribers)
    }

    keySubscribers.add(callback)

    return () => {
      keySubscribers.delete(callback)
      if (keySubscribers.size === 0) {
        subscriptions.delete(key)
      }
    }
  }

  const setAndNotify: MemoryStorageBackend['setAndNotify'] = (key, newValue) => {
    if (newValue == null) {
      storage.delete(key)
    } else {
      storage.set(key, newValue)
    }

    for (const callback of subscriptions.get(key) ?? []) {
      callback(newValue)
    }
  }

  return { get, set, subscribe, setAndNotify }
}

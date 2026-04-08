import type { StorageBackend } from '../types.js'

export interface LocalStorageBackendOptions {
  readonly prefix: string
}

export function createLocalStorageBackend (options: LocalStorageBackendOptions): StorageBackend {
  const { prefix } = options
  const storage = window.localStorage

  const get: StorageBackend['get'] = async (key) => {
    return storage.getItem(`${prefix}:${key}`) ?? undefined
  }

  const set: StorageBackend['set'] = async (key, value) => {
    storage.setItem(`${prefix}:${key}`, value)
  }

  const subscribe: StorageBackend['subscribe'] = (key, callback) => {
    const storageEventHandler = (event: StorageEvent) => {
      if (event.storageArea === storage && event.key === `${prefix}:${key}`) {
        callback(event.newValue ?? undefined)
      }
    }

    window.addEventListener('storage', storageEventHandler)

    return () => {
      window.removeEventListener('storage', storageEventHandler)
    }
  }

  return { get, set, subscribe }
}

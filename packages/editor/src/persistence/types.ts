type UnsubscribeFn = () => void

export type StorageCallback = (newValue: string | undefined) => void

export interface StorageBackend {
  readonly get: (key: string) => Promise<string | undefined>
  readonly set: (key: string, value: string) => Promise<void>
  readonly subscribe: (key: string, callback: StorageCallback) => UnsubscribeFn
}

export interface StoredValue<T = unknown> {
  readonly instanceId: string
  readonly timestamp: number
  readonly payload: T
}

export type PersistenceEvent<T> = |
  { kind: 'updated', value: T } |
  { kind: 'deleted' } |
  { kind: 'invalid' }

export interface PersistenceDomain<T> {
  readonly key: string

  readonly fallbackValue: T

  readonly serialize: (value: T) => unknown
  readonly deserialize: (value: unknown) => T

  readonly areEqual?: (left: T, right: T) => boolean
}

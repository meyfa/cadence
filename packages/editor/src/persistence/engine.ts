import { randomId } from '@utility'
import type { PersistenceDomain, PersistenceEvent, StorageBackend, StoredValue } from './types.js'

export class PersistenceEngine {
  private readonly backend: StorageBackend
  private readonly instanceId: string

  private loadCounter = 0

  constructor (backend: StorageBackend, instanceId: string = randomId()) {
    this.backend = backend
    this.instanceId = instanceId
  }

  get isLoading (): boolean {
    return this.loadCounter > 0
  }

  async load<T> (domain: PersistenceDomain<T>): Promise<T | undefined> {
    ++this.loadCounter

    try {
      const storedValueString = await this.backend.get(domain.key)
      if (storedValueString == null) {
        return undefined
      }

      const envelope = parseStoredValue(storedValueString)
      if (envelope == null) {
        return undefined
      }

      const deserialized = tryDeserialize(domain, envelope.payload)
      return deserialized.ok ? deserialized.value : undefined
    } finally {
      --this.loadCounter
    }
  }

  async save<T> (domain: PersistenceDomain<T>, value: T): Promise<void> {
    const payload = domain.serialize(value)
    const storedValue: StoredValue = {
      instanceId: this.instanceId,
      timestamp: Date.now(),
      payload
    }

    await this.backend.set(domain.key, JSON.stringify(storedValue))
  }

  subscribe<T> (domain: PersistenceDomain<T>, callback: (event: PersistenceEvent<T>) => void): () => void {
    return this.backend.subscribe(domain.key, (newValueString) => {
      if (newValueString == null) {
        callback({ kind: 'deleted' })
        return
      }

      const envelope = parseStoredValue(newValueString)
      if (envelope == null) {
        callback({ kind: 'invalid' })
        return
      }

      if (envelope.instanceId === this.instanceId) {
        // ignore own writes
        return
      }

      const deserialized = tryDeserialize(domain, envelope.payload)
      if (!deserialized.ok) {
        callback({ kind: 'invalid' })
        return
      }

      callback({ kind: 'updated', value: deserialized.value })
    })
  }
}

function tryDeserialize<T> (domain: PersistenceDomain<T>, payload: unknown): { ok: true, value: T } | { ok: false } {
  try {
    return { ok: true, value: domain.deserialize(payload) }
  } catch {
    return { ok: false }
  }
}

function parseStoredValue<T> (valueString: string): StoredValue<T> | undefined {
  try {
    const parsed = JSON.parse(valueString)
    if (typeof parsed !== 'object' || parsed == null) {
      return undefined
    }

    const { instanceId, timestamp, payload } = parsed
    if (typeof instanceId !== 'string' || typeof timestamp !== 'number') {
      return undefined
    }

    return { instanceId, timestamp, payload }
  } catch {
    return undefined
  }
}

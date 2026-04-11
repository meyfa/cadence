import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createMemoryStorageBackend } from '../../src/persistence/backends/memory.js'
import { PersistenceEngine } from '../../src/persistence/engine.js'
import type { PersistenceDomain } from '../../src/persistence/types.js'

describe('persistence/engine.ts', () => {
  const domain: PersistenceDomain<string> = {
    key: 'project',
    fallbackValue: 'fallback',
    serialize: (value) => value.toUpperCase(),
    deserialize: (value) => String(value).toLowerCase()
  }

  it('should return undefined when no value is stored', async () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')

    assert.strictEqual(await engine.load(domain), undefined)
  })

  it('should expose isLoading while a load is in flight', async () => {
    let resolveGet: ((value: string | undefined) => void) | undefined
    const backend = {
      get: async () => await new Promise<string | undefined>((resolve) => {
        resolveGet = resolve
      }),
      set: async () => {},
      subscribe: () => () => {}
    }
    const engine = new PersistenceEngine(backend, 'instance-a')

    assert.strictEqual(engine.isLoading, false)

    const loadPromise = engine.load(domain)

    assert.strictEqual(engine.isLoading, true)

    resolveGet?.(JSON.stringify({
      instanceId: 'instance-b',
      timestamp: 1234,
      payload: 'CADENCE'
    }))

    assert.strictEqual(await loadPromise, 'cadence')
    assert.strictEqual(engine.isLoading, false)
  })

  it('should save serialized values with an instance id and timestamp envelope', async () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')
    const originalDateNow = Date.now

    Date.now = () => 1234

    try {
      await engine.save(domain, 'cadence')
    } finally {
      Date.now = originalDateNow
    }

    assert.deepStrictEqual(JSON.parse((await backend.get(domain.key)) ?? ''), {
      instanceId: 'instance-a',
      timestamp: 1234,
      payload: 'CADENCE'
    })
  })

  it('should load and deserialize a stored value from the backend', async () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')

    await backend.set(domain.key, JSON.stringify({
      instanceId: 'instance-b',
      timestamp: 1234,
      payload: 'CADENCE'
    }))

    assert.strictEqual(await engine.load(domain), 'cadence')
  })

  it('should return undefined when the stored value cannot be parsed as a valid envelope', async () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')

    await backend.set(domain.key, '{invalid-json')
    assert.strictEqual(await engine.load(domain), undefined)

    await backend.set(domain.key, JSON.stringify({ payload: 'CADENCE' }))
    assert.strictEqual(await engine.load(domain), undefined)
  })

  it('should return undefined when deserialization throws during load', async () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')
    const throwingDomain: PersistenceDomain<string> = {
      ...domain,
      deserialize: () => {
        throw new Error('deserialize failed')
      }
    }

    await backend.set(domain.key, JSON.stringify({
      instanceId: 'instance-b',
      timestamp: 1234,
      payload: 'CADENCE'
    }))

    assert.strictEqual(await engine.load(throwingDomain), undefined)
  })

  it('should notify subscribers of changes from other engine instances', () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')
    const receivedEvents: Array<{ kind: string, value?: string }> = []

    engine.subscribe(domain, (event) => {
      receivedEvents.push(event)
    })

    backend.setAndNotify(domain.key, JSON.stringify({
      instanceId: 'instance-b',
      timestamp: 1234,
      payload: 'CADENCE'
    }))

    assert.deepStrictEqual(receivedEvents, [{ kind: 'updated', value: 'cadence' }])
  })

  it('should ignore notifications for values written by the same engine instance', () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')
    const receivedEvents: Array<{ kind: string, value?: string }> = []

    engine.subscribe(domain, (event) => {
      receivedEvents.push(event)
    })

    backend.setAndNotify(domain.key, JSON.stringify({
      instanceId: 'instance-a',
      timestamp: 1234,
      payload: 'CADENCE'
    }))

    assert.deepStrictEqual(receivedEvents, [])
  })

  it('should notify subscribers of deleted and invalid values', () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')
    const receivedEvents: Array<{ kind: string, value?: string }> = []

    engine.subscribe(domain, (event) => {
      receivedEvents.push(event)
    })

    backend.setAndNotify(domain.key, undefined)
    backend.setAndNotify(domain.key, 'not-json')

    assert.deepStrictEqual(receivedEvents, [
      { kind: 'deleted' },
      { kind: 'invalid' }
    ])
  })

  it('should notify subscribers with an invalid event when deserialization throws', () => {
    const backend = createMemoryStorageBackend()
    const engine = new PersistenceEngine(backend, 'instance-a')
    const throwingDomain: PersistenceDomain<string> = {
      ...domain,
      deserialize: () => {
        throw new Error('deserialize failed')
      }
    }
    const receivedEvents: Array<{ kind: string, value?: string }> = []

    engine.subscribe(throwingDomain, (event) => {
      receivedEvents.push(event)
    })

    backend.setAndNotify(domain.key, JSON.stringify({
      instanceId: 'instance-b',
      timestamp: 1234,
      payload: 'CADENCE'
    }))

    assert.deepStrictEqual(receivedEvents, [{ kind: 'invalid' }])
  })
})

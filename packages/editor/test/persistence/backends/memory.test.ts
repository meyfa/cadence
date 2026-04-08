import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createMemoryStorageBackend } from '../../../src/persistence/backends/memory.js'

describe('persistence/backends/memory.ts', () => {
  it('should return undefined for keys that are not present', async () => {
    const backend = createMemoryStorageBackend()

    assert.strictEqual(await backend.get('missing'), undefined)
  })

  it('should persist values that are set', async () => {
    const backend = createMemoryStorageBackend()

    await backend.set('project', 'cadence')

    assert.strictEqual(await backend.get('project'), 'cadence')
  })

  it('should notify subscribers for the matching key when values change', () => {
    const backend = createMemoryStorageBackend()
    const notifiedValues: Array<string | undefined> = []

    backend.subscribe('project', (newValue) => {
      notifiedValues.push(newValue)
    })

    backend.setAndNotify('project', 'cadence')

    assert.deepStrictEqual(notifiedValues, ['cadence'])
  })

  it('should delete values and notify subscribers when setAndNotify receives undefined', async () => {
    const backend = createMemoryStorageBackend()
    const notifiedValues: Array<string | undefined> = []

    await backend.set('project', 'cadence')
    backend.subscribe('project', (newValue) => {
      notifiedValues.push(newValue)
    })

    backend.setAndNotify('project', undefined)

    assert.strictEqual(await backend.get('project'), undefined)
    assert.deepStrictEqual(notifiedValues, [undefined])
  })

  it('should not notify unsubscribed callbacks or subscribers of other keys', () => {
    const backend = createMemoryStorageBackend()
    const activeValues: Array<string | undefined> = []
    const otherKeyValues: Array<string | undefined> = []
    const unsubscribedValues: Array<string | undefined> = []

    const unsubscribe = backend.subscribe('project', (newValue) => {
      activeValues.push(newValue)
    })
    backend.subscribe('other', (newValue) => {
      otherKeyValues.push(newValue)
    })
    const unsubscribeSecond = backend.subscribe('project', (newValue) => {
      unsubscribedValues.push(newValue)
    })

    unsubscribeSecond()
    backend.setAndNotify('project', 'cadence')
    unsubscribe()
    backend.setAndNotify('project', 'updated')

    assert.deepStrictEqual(activeValues, ['cadence'])
    assert.deepStrictEqual(unsubscribedValues, [])
    assert.deepStrictEqual(otherKeyValues, [])
  })
})

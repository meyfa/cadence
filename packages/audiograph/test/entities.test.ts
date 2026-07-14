import type { BusId, InstrumentId } from '@meyfa/cadence-core'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createEntityKey } from '../src/entities.ts'

describe('entities.ts', () => {
  it('should create unique entity keys', () => {
    const key1 = createEntityKey({ type: 'bus', id: 1 as BusId })
    const key2 = createEntityKey({ type: 'bus', id: 2 as BusId })
    const key3 = createEntityKey({ type: 'instrument', id: 1 as InstrumentId })
    const key4 = createEntityKey({ type: 'instrument', id: 2 as InstrumentId })
    const key5 = createEntityKey({ type: 'output' })

    const keys = [key1, key2, key3, key4, key5]
    const uniqueKeys = new Set(keys)

    assert.strictEqual(uniqueKeys.size, keys.length)
  })

  it('should create the same key for the same entity', () => {
    const output1 = createEntityKey({ type: 'output' })
    const output2 = createEntityKey({ type: 'output' })

    assert.strictEqual(output1, output2)

    const bus1 = createEntityKey({ type: 'bus', id: 1 as BusId })
    const bus2 = createEntityKey({ type: 'bus', id: 1 as BusId })

    assert.strictEqual(bus1, bus2)

    const instrument1 = createEntityKey({ type: 'instrument', id: 1 as InstrumentId })
    const instrument2 = createEntityKey({ type: 'instrument', id: 1 as InstrumentId })

    assert.strictEqual(instrument1, instrument2)
  })
})

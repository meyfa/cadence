import { makeNumeric } from '@core/program.js'
import { type FunctionContext } from '@language/compiler/functions.js'
import { instrumentsModule } from '@language/compiler/modules/instruments.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { FunctionType } from '../../../src/compiler/types.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map(),
    automations: new Map()
  }
}

describe('compiler/modules/instruments.ts', () => {
  const instruments = instrumentsModule.data

  describe('sample', () => {
    const sample = instruments.exports.get('sample')
    assert.ok(sample != null && FunctionType.is(sample))

    it('should create instrument from sample', () => {
      const context = createFunctionContext()

      const result = sample.data.invoke(context, {
        url: 'https://example.com/kick.wav',
        gain: makeNumeric('db', -3),
        root_note: 'C4',
        length: makeNumeric('s', 1.5)
      })

      assert.deepStrictEqual(result.data, {
        id: 1,
        sampleUrl: 'https://example.com/kick.wav',
        gain: {
          id: 1,
          initial: makeNumeric('db', -3)
        },
        rootNote: 'C4',
        length: makeNumeric('s', 1.5)
      })

      assert.strictEqual(context.instruments.size, 1)
      const instrument = [...context.instruments.values()][0]

      assert.strictEqual(instrument, result.data)
    })

    it('should create instrument with default values', () => {
      const context = createFunctionContext()

      const result = sample.data.invoke(context, {
        url: 'https://example.com/snare.wav'
      })

      assert.deepStrictEqual(result.data, {
        id: 1,
        sampleUrl: 'https://example.com/snare.wav',
        gain: {
          id: 1,
          initial: makeNumeric('db', 0)
        },
        rootNote: undefined,
        length: undefined
      })

      assert.strictEqual(context.instruments.size, 1)
      const instrument = [...context.instruments.values()][0]

      assert.strictEqual(instrument, result.data)
    })
  })
})

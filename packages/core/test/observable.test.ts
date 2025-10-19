import assert from 'node:assert'
import { describe, it } from 'node:test'
import { MutableObservable } from '../src/observable.js'

describe('observable.ts', () => {
  describe('MutableObservable', () => {
    it('should provide the current value via get()', () => {
      const obs = new MutableObservable(42)
      assert.strictEqual(obs.get(), 42)
    })

    it('should update the value via set()', () => {
      const obs = new MutableObservable(0)
      obs.set(100)
      assert.strictEqual(obs.get(), 100)
    })

    it('should notify new subscribers of the current value', () => {
      const obs = new MutableObservable(0)

      let notifiedValue: number | undefined
      obs.subscribe((value) => {
        notifiedValue = value
      })

      assert.strictEqual(notifiedValue, 0)

      obs.set(42)

      let notifiedValue2: number | undefined
      obs.subscribe((value) => {
        notifiedValue2 = value
      })

      assert.strictEqual(notifiedValue2, 42)
    })

    it('should notify all subscribers on set()', () => {
      const obs = new MutableObservable(0)

      const notifiedValues: number[] = []
      obs.subscribe((value) => {
        notifiedValues.push(value)
      })
      obs.subscribe((value) => {
        notifiedValues.push(value)
      })

      obs.set(1)
      obs.set(2)

      assert.deepStrictEqual(notifiedValues, [0, 0, 1, 1, 2, 2])
    })
  })
})

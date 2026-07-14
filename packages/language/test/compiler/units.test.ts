import assert from 'node:assert'
import { describe, it } from 'node:test'
import { NumberFacet } from '../../src/type-system/base/number.ts'
import { SyntaxUnits, isSyntaxUnit, toBaseUnit, toNumberValue } from '../../src/compiler/units.ts'

describe('compiler/units.ts', () => {
  describe('isSyntaxUnit()', () => {
    it('should accept every declared syntax unit', () => {
      for (const unit of SyntaxUnits) {
        assert.strictEqual(isSyntaxUnit(unit), true)
      }
    })

    it('should reject unknown units', () => {
      assert.strictEqual(isSyntaxUnit('samples'), false)
      assert.strictEqual(isSyntaxUnit(''), false)
    })
  })

  describe('toNumberValue()', () => {
    it('should preserve units that are already base units', () => {
      const constants = { beatsPerBar: 4 }

      const unitless = toNumberValue(constants, undefined, 8)
      const bpm = toNumberValue(constants, 'bpm', 120)
      const decibels = toNumberValue(constants, 'db', -6)
      const hertz = toNumberValue(constants, 'hz', 440)
      const seconds = toNumberValue(constants, 's', 2)
      const beats = toNumberValue(constants, 'beats', 3)

      assert.strictEqual(unitless.type, NumberFacet.with(undefined).type())
      assert.deepStrictEqual(NumberFacet.get(unitless), { unit: undefined, value: 8 })
      assert.deepStrictEqual(NumberFacet.with('bpm').get(bpm), { unit: 'bpm', value: 120 })
      assert.deepStrictEqual(NumberFacet.with('db').get(decibels), { unit: 'db', value: -6 })
      assert.deepStrictEqual(NumberFacet.with('hz').get(hertz), { unit: 'hz', value: 440 })
      assert.deepStrictEqual(NumberFacet.with('s').get(seconds), { unit: 's', value: 2 })
      assert.deepStrictEqual(NumberFacet.with('beats').get(beats), { unit: 'beats', value: 3 })
    })

    it('should normalize milliseconds and bars to base units', () => {
      const constants = { beatsPerBar: 7 }

      const milliseconds = toNumberValue(constants, 'ms', 250)
      const bars = toNumberValue(constants, 'bars', 2)

      assert.strictEqual(milliseconds.type, NumberFacet.with('s').type())
      assert.deepStrictEqual(NumberFacet.with('s').get(milliseconds), { unit: 's', value: 0.25 })

      assert.strictEqual(bars.type, NumberFacet.with('beats').type())
      assert.deepStrictEqual(NumberFacet.with('beats').get(bars), { unit: 'beats', value: 14 })
    })

    it('should accept singular and plural forms of units', () => {
      const constants = { beatsPerBar: 4 }

      const beat = toNumberValue(constants, 'beat', 123)
      const beats = toNumberValue(constants, 'beats', 123)
      assert.deepStrictEqual(beat, beats)

      const bar = toNumberValue(constants, 'bar', 456)
      const bars = toNumberValue(constants, 'bars', 456)
      assert.deepStrictEqual(bar, bars)
    })
  })

  describe('toBaseUnit()', () => {
    it('should preserve base units and convert derived syntax units', () => {
      assert.strictEqual(toBaseUnit(undefined), undefined)
      assert.strictEqual(toBaseUnit('bpm'), 'bpm')
      assert.strictEqual(toBaseUnit('db'), 'db')
      assert.strictEqual(toBaseUnit('hz'), 'hz')
      assert.strictEqual(toBaseUnit('s'), 's')
      assert.strictEqual(toBaseUnit('ms'), 's')
      assert.strictEqual(toBaseUnit('beat'), 'beats')
      assert.strictEqual(toBaseUnit('beats'), 'beats')
      assert.strictEqual(toBaseUnit('bar'), 'beats')
      assert.strictEqual(toBaseUnit('bars'), 'beats')
    })
  })
})

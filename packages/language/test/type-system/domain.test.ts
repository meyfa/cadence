import type { Bus, BusId, Effect, Instrument, InstrumentId, Parameter, ParameterId, Part, Pattern } from '@core'
import { createSerialPattern } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { BusFacet } from '../../src/type-system/domain/bus.js'
import type { Curve } from '../../src/type-system/domain/curve.js'
import { CurveFacet } from '../../src/type-system/domain/curve.js'
import { EffectFacet } from '../../src/type-system/domain/effect.js'
import { InstrumentFacet } from '../../src/type-system/domain/instrument.js'
import { ParameterFacet } from '../../src/type-system/domain/parameter.js'
import { PartFacet } from '../../src/type-system/domain/part.js'
import { PatternFacet } from '../../src/type-system/domain/pattern.js'
import { expectTypeEquals } from '../test-utils.js'

const gainParameter: Parameter<'db'> = {
  id: 1 as ParameterId,
  initial: numeric('db', -6)
}

const panParameter: Parameter<undefined> = {
  id: 2 as ParameterId,
  initial: numeric(undefined, 0.25)
}

const pattern: Pattern = createSerialPattern([
  { value: 'C4' },
  { value: '-', length: numeric(undefined, 1) },
  { value: 'E4', gate: numeric(undefined, 0.5) }
])

const effect: Effect = {
  type: 'gain',
  gain: gainParameter
}

const instrument: Instrument = {
  id: 1 as InstrumentId,
  gain: gainParameter,
  trigger: () => []
}

const part: Part = {
  name: 'intro',
  length: numeric('beats', 4),
  routings: [{
    source: {
      type: 'pattern',
      value: pattern
    },
    destination: {
      type: 'instrument',
      id: instrument.id
    }
  }]
}

const bus: Bus = {
  id: 1 as BusId,
  name: 'main',
  pan: panParameter,
  gain: gainParameter,
  effects: [effect]
}

describe('type-system/domain', () => {
  describe('ParameterFacet', () => {
    it('should support unit-specific parameters and detail()', () => {
      const genericValue = ParameterFacet.type().of(gainParameter)
      const decibelFacet = ParameterFacet.with('db')
      const decibelType = decibelFacet.type()
      const decibelValue = decibelType.of(gainParameter)
      const parameterData = decibelFacet.get(decibelValue)

      expectTypeEquals<Parameter<'db'>, typeof parameterData>()
      assert.strictEqual(ParameterFacet.format(), 'parameter')
      assert.strictEqual(ParameterFacet.with(undefined).format(), 'parameter')
      assert.strictEqual(decibelFacet.format(), 'parameter(db)')
      assert.strictEqual(ParameterFacet.has(decibelValue), true)
      assert.strictEqual(decibelFacet.has(genericValue), false)
      assert.strictEqual(ParameterFacet.detail(decibelType), 'db')
      assert.strictEqual(parameterData.initial.unit, 'db')
      assert.strictEqual(parameterData.initial.value, -6)
      assert.throws(() => ParameterFacet.detail(ParameterFacet.type()), /Invalid generics for parameter facet/)
    })
  })

  describe('CurveFacet', () => {
    it('should support unit-specific curves and detail()', () => {
      const curve: Curve<'db'> = {
        unit: 'db',
        segments: [
          {
            type: 'hold',
            length: numeric('beats', 1),
            unit: 'db',
            value: numeric('db', -6)
          },
          {
            type: 'lin',
            length: numeric('beats', 2),
            unit: 'db',
            start: numeric('db', -6),
            end: numeric('db', 0)
          }
        ]
      }

      const genericValue = CurveFacet.type().of(curve)
      const decibelFacet = CurveFacet.with('db')
      const decibelType = decibelFacet.type()
      const decibelValue = decibelType.of(curve)
      const curveData = decibelFacet.get(decibelValue)

      expectTypeEquals<Curve<'db'>, typeof curveData>()
      assert.strictEqual(CurveFacet.format(), 'curve')
      assert.strictEqual(CurveFacet.with(undefined).format(), 'curve')
      assert.strictEqual(decibelFacet.format(), 'curve(db)')
      assert.strictEqual(CurveFacet.has(decibelValue), true)
      assert.strictEqual(decibelFacet.has(genericValue), false)
      assert.strictEqual(CurveFacet.detail(decibelType), 'db')
      assert.strictEqual(curveData.segments[0]?.unit, 'db')
      assert.strictEqual(curveData.segments[1]?.type, 'lin')
      assert.throws(() => CurveFacet.detail(CurveFacet.type()), /Invalid generics for curve facet/)
    })
  })

  describe('BusFacet', () => {
    it('should format and round-trip bus values', () => {
      const value = BusFacet.type().of(bus)
      const busData = BusFacet.get(value)

      expectTypeEquals<Bus, typeof busData>()
      assert.strictEqual(BusFacet.format(), 'bus')
      assert.strictEqual(BusFacet.has(value), true)
      assert.strictEqual(busData, bus)
    })
  })

  describe('EffectFacet', () => {
    it('should format and round-trip effect values', () => {
      const value = EffectFacet.type().of(effect)
      const effectData = EffectFacet.get(value)

      expectTypeEquals<Effect, typeof effectData>()
      assert.strictEqual(EffectFacet.format(), 'effect')
      assert.strictEqual(EffectFacet.has(value), true)
      assert.strictEqual(effectData, effect)
    })
  })

  describe('InstrumentFacet', () => {
    it('should format and round-trip instrument values', () => {
      const value = InstrumentFacet.type().of(instrument)
      const instrumentData = InstrumentFacet.get(value)

      expectTypeEquals<Instrument, typeof instrumentData>()
      assert.strictEqual(InstrumentFacet.format(), 'instrument')
      assert.strictEqual(InstrumentFacet.has(value), true)
      assert.strictEqual(instrumentData, instrument)
      assert.strictEqual(InstrumentFacet.has(BusFacet.type().of(bus)), false)
    })
  })

  describe('PartFacet', () => {
    it('should format and round-trip part values', () => {
      const value = PartFacet.type().of(part)
      const partData = PartFacet.get(value)

      expectTypeEquals<Part, typeof partData>()
      assert.strictEqual(PartFacet.format(), 'part')
      assert.strictEqual(PartFacet.has(value), true)
      assert.strictEqual(partData, part)
    })
  })

  describe('PatternFacet', () => {
    it('should format and round-trip pattern values', () => {
      const value = PatternFacet.type().of(pattern)
      const patternData = PatternFacet.get(value)

      expectTypeEquals<Pattern, typeof patternData>()
      assert.strictEqual(PatternFacet.format(), 'pattern')
      assert.strictEqual(PatternFacet.has(value), true)
      assert.strictEqual(patternData, pattern)
      assert.deepStrictEqual(Array.from(patternData.evaluate()), Array.from(pattern.evaluate()))
    })
  })
})

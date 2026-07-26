import type { Automation, Bus, BusId, Effect, Instrument, InstrumentId, InstrumentRouting, Mixer, Parameter, ParameterId, Part, Pattern, RelativeCurve, Source, Track, Voice } from '@meyfa/cadence-core'
import { createSerialPattern } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { AutomationFacet } from '../../src/type-system/domain/automation.ts'
import { BusFacet } from '../../src/type-system/domain/bus.ts'
import { CurveFacet } from '../../src/type-system/domain/curve.ts'
import { EffectFacet } from '../../src/type-system/domain/effect.ts'
import { InstrumentFacet } from '../../src/type-system/domain/instrument.ts'
import { MixerFacet } from '../../src/type-system/domain/mixer.ts'
import { ParameterFacet } from '../../src/type-system/domain/parameter.ts'
import { PartFacet } from '../../src/type-system/domain/part.ts'
import { PatternFacet } from '../../src/type-system/domain/pattern.ts'
import { RoutingFacet } from '../../src/type-system/domain/routing.ts'
import { SourceFacet } from '../../src/type-system/domain/source.ts'
import { TrackFacet } from '../../src/type-system/domain/track.ts'
import { VoiceFacet } from '../../src/type-system/domain/voice.ts'
import { expectTypeEquals } from '../test-utils.ts'

const gainParameter: Parameter<'db'> = {
  id: 1 as ParameterId,
  unit: 'db',
  initial: -6 as Numeric<'db'>
}

const panParameter: Parameter<undefined> = {
  id: 2 as ParameterId,
  unit: undefined,
  initial: 0.25 as Numeric<undefined>
}

const pattern: Pattern = createSerialPattern([
  { value: 'C4' },
  { value: '-', length: 1 as Numeric<'beats'> },
  { value: 'E4', gate: 0.5 as Numeric<'beats'> }
])

const effect: Effect = {
  type: 'gain',
  gain: gainParameter
}

const instrument: Instrument = {
  id: 1 as InstrumentId,
  gain: gainParameter,
  voices: []
}

const part: Part = {
  name: 'intro',
  length: 4 as Numeric<'beats'>,
  routings: [
    {
      source: {
        type: 'pattern',
        value: pattern
      },
      destination: {
        type: 'instrument',
        id: instrument.id
      }
    }
  ],
  automations: []
}

const bus: Bus = {
  id: 1 as BusId,
  name: 'main',
  sources: [],
  pan: panParameter,
  gain: gainParameter,
  effects: [effect]
}

const curve: RelativeCurve<'db'> = {
  unit: 'db',
  segments: [
    {
      type: 'hold',
      length: runtimeNumeric('beats', 1),
      unit: 'db',
      value: runtimeNumeric('db', -6)
    },
    {
      type: 'lin',
      length: runtimeNumeric('beats', 2),
      unit: 'db',
      start: runtimeNumeric('db', -6),
      end: runtimeNumeric('db', 0)
    }
  ]
}

const source: Source = {
  type: 'oscillator',
  shape: 'sine',
  frequency: 440 as Numeric<'hz'>
}

const voice: Voice = {
  invoke: () => ({
    source,
    envelope: {
      initial: 0 as Numeric<'db'>,
      points: [
        {
          time: 0 as Numeric<'s'>,
          value: 0 as Numeric<'db'>,
          shape: 'step'
        }
      ]
    }
  })
}

const track: Track = {
  tempo: 120 as Numeric<'bpm'>,
  parts: [part]
}

const mixer: Mixer = {
  buses: [bus],
  routings: []
}

const routing: InstrumentRouting = {
  source: {
    type: 'pattern',
    value: pattern
  },
  destination: {
    type: 'instrument',
    id: instrument.id
  }
}

const automation: Automation = {
  parameterId: gainParameter.id,
  curve
}

describe('type-system/domain', () => {
  describe('AutomationFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(AutomationFacet.format(), 'automation')
    })

    it('should compare by identity', () => {
      assert.strictEqual(AutomationFacet.is(AutomationFacet), true)
      assert.strictEqual(AutomationFacet.is(BusFacet), false)
    })

    it('should round-trip values', () => {
      const value = AutomationFacet.type().of(automation)
      const automationData = AutomationFacet.get(value)

      expectTypeEquals<Automation, typeof automationData>()
      assert.strictEqual(AutomationFacet.has(value), true)
      assert.strictEqual(automationData, automation)
    })
  })

  describe('BusFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(BusFacet.format(), 'bus')
    })

    it('should compare by identity', () => {
      assert.strictEqual(BusFacet.is(BusFacet), true)
      assert.strictEqual(BusFacet.is(EffectFacet), false)
    })

    it('should round-trip values', () => {
      const value = BusFacet.type().of(bus)
      const busData = BusFacet.get(value)

      expectTypeEquals<Bus, typeof busData>()
      assert.strictEqual(BusFacet.has(value), true)
      assert.strictEqual(busData, bus)
    })
  })

  describe('CurveFacet', () => {
    it('should format as facet name with unit suffix', () => {
      assert.strictEqual(CurveFacet.format(), 'curve')
      assert.strictEqual(CurveFacet.with(undefined).format(), 'curve')
      assert.strictEqual(CurveFacet.with('db').format(), 'curve.db')
    })

    it('should compare by identity', () => {
      assert.strictEqual(CurveFacet.is(CurveFacet), true)
      assert.strictEqual(CurveFacet.is(ParameterFacet), false)
    })

    it('should support unit-specific curves and detail()', () => {
      const genericValue = CurveFacet.type().of(curve)
      const decibelFacet = CurveFacet.with('db')
      const decibelType = decibelFacet.type()
      const decibelValue = decibelType.of(curve)
      const curveData = decibelFacet.get(decibelValue)

      expectTypeEquals<RelativeCurve<'db'>, typeof curveData>()
      assert.strictEqual(CurveFacet.has(decibelValue), true)
      assert.strictEqual(decibelFacet.has(genericValue), false)
      assert.strictEqual(CurveFacet.detail(decibelType), 'db')
      assert.strictEqual(curveData.segments[0]?.unit, 'db')
      assert.strictEqual(curveData.segments[1]?.type, 'lin')
      assert.throws(() => CurveFacet.detail(CurveFacet.type()), /Invalid generics for curve facet/)
    })
  })

  describe('EffectFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(EffectFacet.format(), 'effect')
    })

    it('should compare by identity', () => {
      assert.strictEqual(EffectFacet.is(EffectFacet), true)
      assert.strictEqual(EffectFacet.is(InstrumentFacet), false)
    })

    it('should round-trip values', () => {
      const value = EffectFacet.type().of(effect)
      const effectData = EffectFacet.get(value)

      expectTypeEquals<Effect, typeof effectData>()
      assert.strictEqual(EffectFacet.has(value), true)
      assert.strictEqual(effectData, effect)
    })
  })

  describe('InstrumentFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(InstrumentFacet.format(), 'instrument')
    })

    it('should compare by identity', () => {
      assert.strictEqual(InstrumentFacet.is(InstrumentFacet), true)
      assert.strictEqual(InstrumentFacet.is(MixerFacet), false)
    })

    it('should round-trip values', () => {
      const value = InstrumentFacet.type().of(instrument)
      const instrumentData = InstrumentFacet.get(value)

      expectTypeEquals<Instrument, typeof instrumentData>()
      assert.strictEqual(InstrumentFacet.has(value), true)
      assert.strictEqual(instrumentData, instrument)
      assert.strictEqual(InstrumentFacet.has(BusFacet.type().of(bus)), false)
    })
  })

  describe('MixerFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(MixerFacet.format(), 'mixer')
    })

    it('should compare by identity', () => {
      assert.strictEqual(MixerFacet.is(MixerFacet), true)
      assert.strictEqual(MixerFacet.is(ParameterFacet), false)
    })

    it('should round-trip values', () => {
      const value = MixerFacet.type().of(mixer)
      const mixerData = MixerFacet.get(value)

      expectTypeEquals<Mixer, typeof mixerData>()
      assert.strictEqual(MixerFacet.has(value), true)
      assert.strictEqual(mixerData, mixer)
    })
  })

  describe('ParameterFacet', () => {
    it('should format as facet name with unit suffix', () => {
      assert.strictEqual(ParameterFacet.format(), 'parameter')
      assert.strictEqual(ParameterFacet.with(undefined).format(), 'parameter')
      assert.strictEqual(ParameterFacet.with('db').format(), 'parameter.db')
    })

    it('should compare by identity', () => {
      assert.strictEqual(ParameterFacet.is(ParameterFacet), true)
      assert.strictEqual(ParameterFacet.is(PartFacet), false)
    })

    it('should support unit-specific parameters and detail()', () => {
      const genericValue = ParameterFacet.type().of(gainParameter)
      const decibelFacet = ParameterFacet.with('db')
      const decibelType = decibelFacet.type()
      const decibelValue = decibelType.of(gainParameter)
      const parameterData = decibelFacet.get(decibelValue)

      expectTypeEquals<Parameter<'db'>, typeof parameterData>()
      assert.strictEqual(ParameterFacet.has(decibelValue), true)
      assert.strictEqual(decibelFacet.has(genericValue), false)
      assert.strictEqual(ParameterFacet.detail(decibelType), 'db')
      assert.strictEqual(parameterData.initial, -6)
      assert.throws(() => ParameterFacet.detail(ParameterFacet.type()), /Invalid generics for parameter facet/)
    })
  })

  describe('PartFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(PartFacet.format(), 'part')
    })

    it('should compare by identity', () => {
      assert.strictEqual(PartFacet.is(PartFacet), true)
      assert.strictEqual(PartFacet.is(PatternFacet), false)
    })

    it('should round-trip values', () => {
      const value = PartFacet.type().of(part)
      const partData = PartFacet.get(value)

      expectTypeEquals<Part, typeof partData>()
      assert.strictEqual(PartFacet.has(value), true)
      assert.strictEqual(partData, part)
    })
  })

  describe('PatternFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(PatternFacet.format(), 'pattern')
    })

    it('should compare by identity', () => {
      assert.strictEqual(PatternFacet.is(PatternFacet), true)
      assert.strictEqual(PatternFacet.is(RoutingFacet), false)
    })

    it('should round-trip values', () => {
      const value = PatternFacet.type().of(pattern)
      const patternData = PatternFacet.get(value)

      expectTypeEquals<Pattern, typeof patternData>()
      assert.strictEqual(PatternFacet.has(value), true)
      assert.strictEqual(patternData, pattern)
      assert.deepStrictEqual(Array.from(patternData.evaluate()), Array.from(pattern.evaluate()))
    })
  })

  describe('RoutingFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(RoutingFacet.format(), 'routing')
    })

    it('should compare by identity', () => {
      assert.strictEqual(RoutingFacet.is(RoutingFacet), true)
      assert.strictEqual(RoutingFacet.is(SourceFacet), false)
    })

    it('should round-trip values', () => {
      const value = RoutingFacet.type().of(routing)
      const routingData = RoutingFacet.get(value)

      expectTypeEquals<InstrumentRouting, typeof routingData>()
      assert.strictEqual(RoutingFacet.has(value), true)
      assert.strictEqual(routingData, routing)
    })
  })

  describe('SourceFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(SourceFacet.format(), 'source')
    })

    it('should compare by identity', () => {
      assert.strictEqual(SourceFacet.is(SourceFacet), true)
      assert.strictEqual(SourceFacet.is(TrackFacet), false)
    })

    it('should round-trip values', () => {
      const value = SourceFacet.type().of(source)
      const sourceData = SourceFacet.get(value)

      expectTypeEquals<Source, typeof sourceData>()
      assert.strictEqual(SourceFacet.has(value), true)
      assert.strictEqual(sourceData, source)
    })
  })

  describe('TrackFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(TrackFacet.format(), 'track')
    })

    it('should compare by identity', () => {
      assert.strictEqual(TrackFacet.is(TrackFacet), true)
      assert.strictEqual(TrackFacet.is(VoiceFacet), false)
    })

    it('should round-trip values', () => {
      const value = TrackFacet.type().of(track)
      const trackData = TrackFacet.get(value)

      expectTypeEquals<Track, typeof trackData>()
      assert.strictEqual(TrackFacet.has(value), true)
      assert.strictEqual(trackData, track)
    })
  })

  describe('VoiceFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(VoiceFacet.format(), 'voice')
    })

    it('should compare by identity', () => {
      assert.strictEqual(VoiceFacet.is(VoiceFacet), true)
      assert.strictEqual(VoiceFacet.is(AutomationFacet), false)
    })

    it('should round-trip values', () => {
      const value = VoiceFacet.type().of(voice)
      const voiceData = VoiceFacet.get(value)

      expectTypeEquals<Voice, typeof voiceData>()
      assert.strictEqual(VoiceFacet.has(value), true)
      assert.strictEqual(voiceData, voice)
    })
  })
})

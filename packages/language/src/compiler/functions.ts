import { createPattern, loopPattern } from '@core/pattern.js'
import { isPitch, makeNumeric, type Instrument, type InstrumentId } from '@core/program.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { EffectType, FunctionType, InstrumentType, NumberType, PatternType, StringType, type FunctionValue, type Type, type Value } from './types.js'

export const standardLibraryModuleNames: ReadonlySet<string> = Object.freeze(new Set([
  'patterns',
  'instruments',
  'effects'
]))

export interface FunctionDefinition<S extends PropertySchema = PropertySchema, R extends Type = Type> {
  readonly arguments: S
  readonly returnType: R
  readonly invoke: FunctionHandler<S>
}

export type FunctionHandler<S extends PropertySchema> = (context: FunctionContext, args: InferSchema<S>) => Value

export interface FunctionContext {
  readonly instruments: Map<InstrumentId, Instrument>
}

export function getDefaultFunctions (imports: readonly string[]): ReadonlyMap<string, FunctionValue> {
  const functions = new Map<string, FunctionValue>()

  if (imports.includes('patterns')) {
    functions.set('loop', loop)
  }

  if (imports.includes('instruments')) {
    functions.set('sample', sample)
  }

  if (imports.includes('effects')) {
    functions.set('gain', gain)
    functions.set('pan', pan)
    functions.set('delay', delay)
    functions.set('reverb', reverb)
  }

  return functions
}

// patterns

const loop = FunctionType.of({
  arguments: [
    { name: 'pattern', type: PatternType, required: true },
    { name: 'times', type: NumberType.with(undefined), required: false }
  ],

  returnType: PatternType,

  invoke: (_context, { pattern, times }) => {
    if (times == null) {
      return PatternType.of(loopPattern(pattern))
    }

    const factor = times.value
    if (factor <= 0 || !Number.isFinite(factor)) {
      return PatternType.of(createPattern([], 1))
    }

    if (pattern.length == null) {
      // infinite pattern multiplied by finite factor remains infinite
      return PatternType.of(loopPattern(pattern))
    }

    const duration = makeNumeric('beats', pattern.length.value * factor)

    return PatternType.of(loopPattern(pattern, duration))
  }
})

// sources

const sample = FunctionType.of({
  arguments: [
    { name: 'url', type: StringType, required: true },
    { name: 'gain', type: NumberType.with('db'), required: false },
    { name: 'root_note', type: StringType, required: false },
    { name: 'length', type: NumberType.with('s'), required: false }
  ],

  returnType: InstrumentType,

  // eslint-disable-next-line camelcase
  invoke: (context, { url, gain, root_note, length }) => {
    const currentMaxId = Math.max(0, ...Array.from(context.instruments.keys()))
    const instrument = InstrumentType.of({
      id: (currentMaxId + 1) as InstrumentId,
      sampleUrl: url,
      gain,
      // eslint-disable-next-line camelcase
      rootNote: isPitch(root_note) ? root_note : undefined,
      length
    })

    context.instruments.set(instrument.data.id, instrument.data)

    return instrument
  }
})

// effects

const gain = FunctionType.of({
  arguments: [
    { name: 'gain', type: NumberType.with('db'), required: true }
  ],

  returnType: EffectType,

  invoke: (context, { gain }) => {
    return EffectType.of({
      type: 'gain',
      gain
    })
  }
})

const pan = FunctionType.of({
  arguments: [
    { name: 'pan', type: NumberType.with(undefined), required: true }
  ],

  returnType: EffectType,

  invoke: (context, { pan }) => {
    return EffectType.of({
      type: 'pan',
      pan
    })
  }
})

const delay = FunctionType.of({
  arguments: [
    { name: 'time', type: NumberType.with('beats'), required: true },
    { name: 'feedback', type: NumberType.with(undefined), required: true }
  ],

  returnType: EffectType,

  invoke: (context, { time, feedback }) => {
    return EffectType.of({
      type: 'delay',
      time,
      feedback
    })
  }
})

const reverb = FunctionType.of({
  arguments: [
    { name: 'decay', type: NumberType.with('s'), required: true },
    { name: 'mix', type: NumberType.with(undefined), required: true }
  ],

  returnType: EffectType,

  invoke: (context, args) => {
    return EffectType.of({
      type: 'reverb',
      decay: args.decay,
      mix: args.mix
    })
  }
})

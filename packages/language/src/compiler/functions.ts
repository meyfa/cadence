import { isPitch, type Instrument, type InstrumentId } from '@core/program.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { EffectType, FunctionType, InstrumentType, NumberType, StringType, type FunctionValue, type Type, type Value } from './types.js'

export interface FunctionDefinition<S extends PropertySchema = PropertySchema, R extends Type = Type> {
  readonly arguments: S
  readonly returnType: R
  readonly invoke: FunctionHandler<S>
}

export type FunctionHandler<S extends PropertySchema> = (context: FunctionContext, args: InferSchema<S>) => Value

export interface FunctionContext {
  readonly instruments: Map<InstrumentId, Instrument>
}

export function getDefaultFunctions (): ReadonlyMap<string, FunctionValue> {
  const functions = new Map<string, FunctionValue>()

  // sources
  functions.set('sample', sample)

  // effects
  functions.set('delay', delay)

  return functions
}

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

const delay = FunctionType.of({
  arguments: [
    { name: 'time', type: NumberType.with('steps'), required: true },
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

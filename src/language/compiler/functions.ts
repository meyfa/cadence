import type { Instrument, InstrumentId } from '../../core/program.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { makeInstrument, type TypeInfo, type Value } from './values.js'

export interface FunctionDefinition<S extends PropertySchema = PropertySchema> {
  readonly arguments: S
  readonly returnType: TypeInfo
  readonly invoke: FunctionHandler<S>
}

export type FunctionHandler<S extends PropertySchema> = (context: FunctionContext, args: InferSchema<S>) => Value

export interface FunctionContext {
  readonly instruments: Map<InstrumentId, Instrument>
}

export function defineFunction<S extends PropertySchema> (def: FunctionDefinition<S>): typeof def {
  return def
}

const sample = defineFunction({
  arguments: [
    { name: 'url', type: { type: 'String' }, required: true }
  ],

  returnType: { type: 'Instrument' },

  invoke: (context, { url }) => {
    const currentMaxId = Math.max(0, ...Array.from(context.instruments.keys()))
    const instrument = makeInstrument({
      id: (currentMaxId + 1) as InstrumentId,
      sampleUrl: url
    })

    context.instruments.set(instrument.value.id, instrument.value)

    return instrument
  }
})

export function getDefaultFunctions (): ReadonlyMap<string, FunctionDefinition> {
  const functions = new Map<string, FunctionDefinition>()
  functions.set('sample', sample)
  return functions
}

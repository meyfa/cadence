import { isPitch, type Instrument, type InstrumentId } from '../../core/program.js'
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

export function defineFunction<const S extends PropertySchema> (def: FunctionDefinition<S>): typeof def {
  return def
}

const sample = defineFunction({
  arguments: [
    { name: 'url', type: { type: 'String' }, required: true },
    { name: 'gain', type: { type: 'Number', unit: 'db' }, required: false },
    { name: 'root_note', type: { type: 'String' }, required: false },
    { name: 'length', type: { type: 'Number', unit: 's' }, required: false }
  ],

  returnType: { type: 'Instrument' },

  // eslint-disable-next-line camelcase
  invoke: (context, { url, gain, root_note, length }) => {
    const currentMaxId = Math.max(0, ...Array.from(context.instruments.keys()))
    const instrument = makeInstrument({
      id: (currentMaxId + 1) as InstrumentId,
      sampleUrl: url,
      gain,
      // eslint-disable-next-line camelcase
      rootNote: isPitch(root_note) ? root_note : undefined,
      length
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

import { type Instrument, type InstrumentId, isPitch, makeNumeric, type Numeric, type Parameter, type ParameterId, type Unit } from '@core/program.js'
import { FunctionType, InstrumentType, ModuleType, NumberType, StringType, type InstrumentValue, type Value } from '../types.js'
import type { FunctionContext } from '../functions.js'

const UNITY_GAIN = makeNumeric('db', 0)

function allocateInstrument (context: FunctionContext, data: Omit<Instrument, 'id'>): InstrumentValue {
  const currentMaxId = Math.max(0, ...Array.from(context.instruments.keys()))
  const id = (currentMaxId + 1) as InstrumentId

  const instrument = InstrumentType.of({ ...data, id })
  context.instruments.set(instrument.data.id, instrument.data)

  return instrument
}

function allocateParameter<U extends Unit> (context: FunctionContext, initial: Numeric<U>): Parameter<U> {
  const currentMaxId = Math.max(0, ...Array.from(context.automations.keys()))
  const id = (currentMaxId + 1) as ParameterId

  context.automations.set(id, {
    parameterId: id,
    points: []
  })

  return { id, initial }
}

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
    const gainParameter = allocateParameter(context, gain ?? UNITY_GAIN)

    return allocateInstrument(context, {
      sampleUrl: url,
      gain: gainParameter,
      // eslint-disable-next-line camelcase
      rootNote: isPitch(root_note) ? root_note : undefined,
      length
    })
  }
})

export const instrumentsModule = ModuleType.of({
  name: 'instruments',

  exports: new Map<string, Value>([
    ['sample', sample]
  ])
})

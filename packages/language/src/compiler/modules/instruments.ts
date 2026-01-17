import { type InstrumentId, isPitch } from '@core/program.js'
import { FunctionType, InstrumentType, ModuleType, NumberType, StringType, type Value } from '../types.js'

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

export const instrumentsModule = ModuleType.of({
  name: 'instruments',

  exports: new Map<string, Value>([
    ['sample', sample]
  ])
})

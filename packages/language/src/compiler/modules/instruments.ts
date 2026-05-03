import { isPitch } from '@core'
import { numeric } from '@utility'
import { allocateInstrument, allocateParameter } from '../functions.js'
import type { Value } from '../types.js'
import { FunctionType, InstrumentType, ModuleType, NumberType, StringType } from '../types.js'

const UNITY_GAIN = numeric('db', 0)

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

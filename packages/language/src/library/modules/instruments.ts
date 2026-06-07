import type { Envelope, Oscillator } from '@core'
import { isPitch } from '@core'
import { numeric } from '@utility'
import type { InstrumentContext, ParameterContext } from '../../compiler/generator/scopes.js'
import { NumberFacet } from '../../type-system/base/number.js'
import { RecordFacet } from '../../type-system/base/record.js'
import { StringFacet } from '../../type-system/base/string.js'
import { InstrumentFacet } from '../../type-system/domain/instrument.js'
import { ParameterFacet } from '../../type-system/domain/parameter.js'
import { makeType } from '../../type-system/factory.js'
import { Functions, Modules, Parameters } from '../../type-system/helpers.js'
import { makeSchema } from '../../type-system/schema.js'
import type { Value } from '../../type-system/types.js'

const UNITY_GAIN = numeric('db', 0)

const ENVELOPE_DECLICK: Envelope = {
  attack: numeric('s', 0.003),
  decay: numeric('s', 0),
  sustain: numeric(undefined, 1),
  release: numeric('s', 0.003)
}

const SampleInstrumentType = makeType(InstrumentFacet, RecordFacet.with({
  gain: ParameterFacet.with('db').type()
}))

const OscillatorInstrumentType = makeType(InstrumentFacet, RecordFacet.with({
  gain: ParameterFacet.with('db').type()
}))

const sample = Functions.of({
  summary: 'Creates a sample-backed instrument from a URL.',

  parameters: makeSchema([
    { name: 'url', type: StringFacet.type(), required: true },
    { name: 'gain', type: NumberFacet.with('db').type(), required: false },
    { name: 'root_note', type: StringFacet.type(), required: false },
    { name: 'length', type: NumberFacet.with('s').type(), required: false }
  ]),

  returnType: SampleInstrumentType,

  // eslint-disable-next-line camelcase
  invoke: (context: ParameterContext & InstrumentContext, { url, gain, root_note, length }) => {
    const urlValue = StringFacet.get(url)
    const gainValue = gain != null ? NumberFacet.get(gain) : UNITY_GAIN
    // eslint-disable-next-line camelcase
    const rootNoteValue = root_note != null ? StringFacet.get(root_note) : undefined
    const lengthValue = length != null ? NumberFacet.get(length) : undefined

    const gainParameter = context.allocateParameter(gainValue)

    const instrument = context.allocateInstrument({
      gain: gainParameter,
      rootNote: rootNoteValue != null && isPitch(rootNoteValue) ? rootNoteValue : undefined,
      source: {
        type: 'sample',
        url: urlValue,
        length: lengthValue
      },
      envelope: ENVELOPE_DECLICK
    })

    return SampleInstrumentType.of(instrument, {
      gain: Parameters.of(gainParameter)
    })
  }
})

function createOscillatorFunction (shape: Oscillator['shape']): Value {
  return Functions.of({
    summary: `Creates an instrument that produces a ${shape} wave.`,

    parameters: makeSchema([
      { name: 'gain', type: NumberFacet.with('db').type(), required: false }
    ]),

    returnType: OscillatorInstrumentType,

    invoke: (context: ParameterContext & InstrumentContext, { gain }) => {
      const gainValue = gain != null ? NumberFacet.get(gain) : UNITY_GAIN
      const gainParameter = context.allocateParameter(gainValue)

      const instrument = context.allocateInstrument({
        gain: gainParameter,
        source: {
          type: 'oscillator',
          shape
        },
        envelope: ENVELOPE_DECLICK
      })

      return OscillatorInstrumentType.of(instrument, {
        gain: Parameters.of(gainParameter)
      })
    }
  })
}

const sine = createOscillatorFunction('sine')
const square = createOscillatorFunction('square')
const saw = createOscillatorFunction('saw')
const triangle = createOscillatorFunction('triangle')

export const instrumentsModule = Modules.of({
  name: 'instruments',
  summary: 'Functions for creating and manipulating instruments.',

  exports: new Map<string, Value>([
    ['sample', sample],
    ['sine', sine],
    ['square', square],
    ['saw', saw],
    ['triangle', triangle]
  ])
})

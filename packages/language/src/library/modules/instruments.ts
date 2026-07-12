import type { Oscillator } from '@core'
import { beatsToSeconds, convertPitchToMidi, getMidiFrequency, isPitch } from '@core'
import type { Numeric } from '@utility'
import type { AssetContext, InstrumentContext, ParameterContext } from '../../compiler/generator/scopes.js'
import { NumberFacet } from '../../type-system/base/number.js'
import { RecordFacet } from '../../type-system/base/record.js'
import { StringFacet } from '../../type-system/base/string.js'
import { InstrumentFacet } from '../../type-system/domain/instrument.js'
import { ParameterFacet } from '../../type-system/domain/parameter.js'
import { makeType } from '../../type-system/factory.js'
import { Functions, Modules, Parameters } from '../../type-system/helpers.js'
import { makeSchema } from '../../type-system/schema.js'
import type { Value } from '../../type-system/types.js'
import type { Envelope } from '../envelope.js'
import { applyEnvelope } from '../envelope.js'

const DEFAULT_ROOT_NOTE = convertPitchToMidi('C5')

const UNITY_GAIN = 0 as Numeric<'db'>

const ENVELOPE_DECLICK: Envelope = {
  attack: 0.003 as Numeric<'s'>,
  decay: 0 as Numeric<'s'>,
  sustain: 0 as Numeric<'db'>,
  release: 0.003 as Numeric<'s'>
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
  effects: { blocking: true },

  // eslint-disable-next-line camelcase
  invoke: (context: ParameterContext & InstrumentContext & AssetContext, { url, gain, root_note, length }) => {
    const urlValue = StringFacet.get(url)
    const gainValue = gain != null ? NumberFacet.get(gain).value : UNITY_GAIN
    const rootNote = (() => {
      // eslint-disable-next-line camelcase
      const string = root_note != null ? StringFacet.get(root_note) : undefined
      return string != null && isPitch(string) ? string : undefined
    })()
    const lengthValue = length != null ? NumberFacet.get(length).value : undefined

    const gainParameter = context.allocateParameter('db', gainValue)

    const asset = context.allocateAsset({
      url: urlValue
    })

    const rootNoteMidi = rootNote != null ? convertPitchToMidi(rootNote) : DEFAULT_ROOT_NOTE

    const invalidLength = lengthValue != null && (!Number.isFinite(lengthValue) || lengthValue <= 0)

    const instrument = context.allocateInstrument({
      gain: gainParameter,

      trigger: (note, tempo) => {
        if (invalidLength) {
          return []
        }

        const midiNote = note.pitch != null ? convertPitchToMidi(note.pitch) : rootNoteMidi
        const playbackRate = Math.pow(2, (midiNote - rootNoteMidi) / 12) as Numeric<undefined>

        const gate: Numeric<'s'> | undefined = (() => {
          if (note.gate == null) {
            return lengthValue
          }
          const gateSeconds = beatsToSeconds(note.gate, tempo)
          return lengthValue == null ? gateSeconds : Math.min(gateSeconds, lengthValue) as Numeric<'s'>
        })()

        const envelope = applyEnvelope(ENVELOPE_DECLICK, { velocity: note.velocity, gate })
        const duration = gate != null ? envelope.points.at(-1)?.time : undefined

        return [
          {
            envelope,
            source: {
              type: 'sample',
              assetId: asset.id,
              length: lengthValue,
              playbackRate
            },
            duration
          }
        ]
      }
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
    effects: { blocking: true },

    invoke: (context: ParameterContext & InstrumentContext, { gain }) => {
      const gainValue = gain != null ? NumberFacet.get(gain).value : UNITY_GAIN
      const gainParameter = context.allocateParameter('db', gainValue)

      const instrument = context.allocateInstrument({
        gain: gainParameter,

        trigger: (note, tempo) => {
          const midiNote = note.pitch != null ? convertPitchToMidi(note.pitch) : DEFAULT_ROOT_NOTE
          const frequency = getMidiFrequency(midiNote)

          const gate = note.gate != null ? beatsToSeconds(note.gate, tempo) : undefined
          const envelope = applyEnvelope(ENVELOPE_DECLICK, { velocity: note.velocity, gate })
          const duration = gate != null ? envelope.points.at(-1)?.time : undefined

          return [
            {
              envelope,
              source: {
                type: 'oscillator',
                shape,
                frequency
              },
              duration
            }
          ]
        }
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

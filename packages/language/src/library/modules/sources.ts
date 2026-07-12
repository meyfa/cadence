import type { Oscillator } from '@core'
import { NumberFacet } from '../../type-system/base/number.js'
import { SourceFacet } from '../../type-system/domain/source.js'
import { Functions, Modules } from '../../type-system/helpers.js'
import { makeSchema } from '../../type-system/schema.js'
import type { Value } from '../../type-system/types.js'

function createOscillatorFunction (shape: Oscillator['shape']): Value {
  return Functions.of({
    summary: `Creates a source that produces a ${shape} wave.`,

    parameters: makeSchema([
      { name: 'frequency', type: NumberFacet.with('hz').type(), required: true }
    ]),
    returnType: SourceFacet.type(),
    effects: { blocking: false },

    invoke: (context, { frequency }) => {
      return SourceFacet.type().of({
        type: 'oscillator',
        shape,
        frequency: NumberFacet.get(frequency).value
      })
    }
  })
}

const sine = createOscillatorFunction('sine')
const square = createOscillatorFunction('square')
const saw = createOscillatorFunction('saw')
const triangle = createOscillatorFunction('triangle')

export const sourcesModule = Modules.of({
  name: 'sources',
  summary: 'Functions for creating audio sources that can be used in instruments.',

  exports: new Map<string, Value>([
    ['sine', sine],
    ['square', square],
    ['saw', saw],
    ['triangle', triangle]
  ])
})

import type { Oscillator } from '@meyfa/cadence-core'
import { NumberFacet } from '../../type-system/base/number.ts'
import { SourceFacet } from '../../type-system/domain/source.ts'
import { Functions, Modules } from '../../type-system/helpers.ts'
import { makeSchema } from '../../type-system/schema.ts'
import type { Value } from '../../type-system/types.ts'

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

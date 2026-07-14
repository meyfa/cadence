import { convertPitchToMidi } from '@meyfa/cadence-core'
import { NumberFacet } from '../type-system/base/number.js'
import { RecordFacet } from '../type-system/base/record.js'
import { makeSchema } from '../type-system/schema.js'

export const DEFAULT_ROOT_NOTE = convertPitchToMidi('C5')

export const BUS_NAMESPACE = 'bus'

export const trackSchema = makeSchema([
  {
    name: 'tempo',
    type: NumberFacet.with('bpm').type(),
    required: false
  }
])

export const partSchema = makeSchema([
  {
    name: 'length',
    type: NumberFacet.with('beats').type(),
    required: true
  }
])

export const mixerSchema = makeSchema([
  // no properties defined yet
])

export const busSchema = makeSchema([
  {
    name: 'gain',
    type: NumberFacet.with('db').type(),
    required: false
  },
  {
    name: 'pan',
    type: NumberFacet.with(undefined).type(),
    required: false
  }
])

export const stepSchema = makeSchema([
  {
    name: 'gate',
    type: NumberFacet.with(undefined).type(),
    required: false
  },
  {
    name: 'vel',
    type: NumberFacet.with(undefined).type(),
    required: false
  }
])

export const noteType = RecordFacet.with({
  frequency: NumberFacet.with('hz').type(),
  gate: NumberFacet.with('beats').type(),
  velocity: NumberFacet.with(undefined).type()
}).type()

export type NoteValue = ReturnType<typeof noteType.of>

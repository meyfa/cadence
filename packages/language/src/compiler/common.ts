import { NumberFacet } from '../type-system/base/number.js'
import { makeSchema } from '../type-system/schema.js'

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
  }
])

import { definePropertySchema } from './schema.js'
import { NumberType } from './types.js'

export const trackSchema = definePropertySchema([
  {
    name: 'tempo',
    type: NumberType.with('bpm'),
    required: false
  }
])

export const partSchema = definePropertySchema([
  {
    name: 'length',
    type: NumberType.with('beats'),
    required: true
  }
])

export const mixerSchema = definePropertySchema([
  // no properties defined yet
])

export const busSchema = definePropertySchema([
  {
    name: 'gain',
    type: NumberType.with('db'),
    required: false
  },
  {
    name: 'pan',
    type: NumberType.with(undefined),
    required: false
  }
])

export const stepSchema = definePropertySchema([
  {
    name: 'gate',
    type: NumberType.with(undefined),
    required: false
  }
])

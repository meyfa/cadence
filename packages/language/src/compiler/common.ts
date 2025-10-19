import { definePropertySchema } from './schema.js'
import { NumberType } from './types.js'

export const trackSchema = definePropertySchema([
  {
    name: 'tempo',
    type: NumberType.with('bpm'),
    required: false
  }
])

export const sectionSchema = definePropertySchema([
  // no properties defined yet
])

export const mixerSchema = definePropertySchema([
  // no properties defined yet
])

export const busSchema = definePropertySchema([
  {
    name: 'gain',
    type: NumberType.with('db'),
    required: false
  }
])

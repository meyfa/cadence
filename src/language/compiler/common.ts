import { definePropertySchema } from './schema.js'

export const trackSchema = definePropertySchema([
  {
    name: 'tempo',
    type: {
      type: 'Number',
      unit: 'bpm'
    },
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
    type: {
      type: 'Number',
      unit: 'db'
    },
    required: false
  }
])

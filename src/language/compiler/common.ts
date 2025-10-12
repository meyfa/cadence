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

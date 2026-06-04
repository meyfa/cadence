import { makeFacet } from '../factory.js'
import type { FacetType, ValueForType } from '../types.js'

type RecordGenerics = Readonly<Partial<Record<string, FacetType>>>

type RecordDataForFields<Fields extends RecordGenerics> = {
  readonly [K in keyof Fields]: ValueForType<Fields[K]>
}

const FACET_NAME = 'record'

export const RecordFacet = {
  ...makeFacet<typeof FACET_NAME, RecordDataForFields<RecordGenerics>>(FACET_NAME, {}),

  with: <const Fields extends RecordGenerics> (fields: Fields) => {
    return makeFacet<typeof FACET_NAME, RecordDataForFields<Fields>>(FACET_NAME, fields, {
      format: () => `${FACET_NAME}(${Object.keys(fields).join(', ')})`
    })
  },

  detail: (type: FacetType): RecordGenerics => {
    return type.getFacet(FACET_NAME).generics as RecordGenerics
  }
}

import { makeFacet } from '../factory.ts'
import type { FacetType, ValueForType } from '../types.ts'

type RecordGenerics = Readonly<Partial<Record<string, FacetType>>>

type RecordDataForFields<Fields extends RecordGenerics> = {
  readonly [K in keyof Fields]: ValueForType<Fields[K]>
}

const FACET_NAME = 'record'

function cloneOwnProperties<const T extends Record<string, unknown>> (value: T): T {
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Expected ${FACET_NAME} facet data to use a plain object or null prototype`)
  }

  const clone = Object.create(null) as T
  for (const key of Object.keys(value) as Array<keyof T>) {
    clone[key] = value[key]
  }

  return clone
}

function normalizeRecordData<Fields extends RecordGenerics> (data: unknown): RecordDataForFields<Fields> {
  if (typeof data !== 'object' || data == null) {
    throw new Error(`Expected ${FACET_NAME} facet data to be an object`)
  }

  return cloneOwnProperties(data as RecordDataForFields<Fields> & Record<string, unknown>) as RecordDataForFields<Fields>
}

const EMPTY_RECORD_GENERICS = cloneOwnProperties({} as Record<string, unknown>) as RecordGenerics

export const RecordFacet = {
  ...makeFacet<typeof FACET_NAME, RecordDataForFields<RecordGenerics>>(FACET_NAME, EMPTY_RECORD_GENERICS, {
    normalize: (data) => normalizeRecordData<RecordGenerics>(data)
  }),

  with: <const Fields extends RecordGenerics> (fields: Fields) => {
    const safeFields = cloneOwnProperties(fields)

    return makeFacet<typeof FACET_NAME, RecordDataForFields<Fields>>(FACET_NAME, safeFields, {
      format: () => `${FACET_NAME}(${Object.keys(safeFields).join(', ')})`,
      normalize: (data) => normalizeRecordData<Fields>(data)
    })
  },

  detail: (type: FacetType): RecordGenerics => {
    return type.getFacet(FACET_NAME).generics as RecordGenerics
  }
}

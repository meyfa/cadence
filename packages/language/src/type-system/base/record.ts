import { makeFacet } from '../factory.ts'
import { intersectTypes, mergeTypes } from '../transforms.ts'
import type { Facet, FacetType, Type, ValueForType } from '../types.ts'

type RecordGenerics = Readonly<Partial<Record<string, Type>>>

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

function mergeRecordGenerics (a: RecordGenerics, b: RecordGenerics): RecordGenerics | undefined {
  const fields: Record<string, Type> = Object.create(null)

  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const aType = a[key]
    const bType = b[key]

    if (aType != null && bType != null) {
      const mergedType = mergeTypes(aType, bType)
      if (mergedType == null) {
        return undefined
      }
      fields[key] = mergedType
    } else if (aType != null) {
      fields[key] = aType
    } else if (bType != null) {
      fields[key] = bType
    }
  }

  return fields
}

function intersectRecordGenerics (a: RecordGenerics, b: RecordGenerics): RecordGenerics | undefined {
  const fields: Record<string, Type> = Object.create(null)

  for (const key of Object.keys(a)) {
    const aType = a[key]
    const bType = b[key]

    const intersection = aType != null && bType != null
      ? intersectTypes(aType, bType)
      : undefined

    if (intersection != null) {
      fields[key] = intersection
    }
  }

  return fields
}

function recordWith<const Fields extends RecordGenerics> (fields: Fields): Facet<typeof FACET_NAME, RecordDataForFields<Fields>> {
  const safeFields = cloneOwnProperties(fields)

  return makeFacet<typeof FACET_NAME, RecordDataForFields<Fields>>(FACET_NAME, safeFields, {
    format: () => {
      const fields = Object.entries(safeFields)
        .map(([name, type]) => `${name}: ${type?.format()}`)
        .join(', ')

      return `{${fields}}`
    },

    normalize: (data) => normalizeRecordData<Fields>(data),

    merge: (other: Facet) => {
      if (other.name !== FACET_NAME) {
        return undefined
      }

      const merged = mergeRecordGenerics(safeFields, other.generics as RecordGenerics)
      return merged == null ? undefined : recordWith(merged)
    },

    intersect: (other: Facet) => {
      if (other.name !== FACET_NAME) {
        return undefined
      }

      const intersected = intersectRecordGenerics(safeFields, other.generics as RecordGenerics)
      return intersected == null ? undefined : recordWith(intersected)
    }
  })
}

export const RecordFacet = {
  ...makeFacet<typeof FACET_NAME, RecordDataForFields<RecordGenerics>>(FACET_NAME, EMPTY_RECORD_GENERICS, {
    normalize: (data) => normalizeRecordData<RecordGenerics>(data),

    merge: (other: Facet): Facet | undefined => {
      // The generics of 'this' are unknown, so return the other facet such that
      // merge(this, other) yields precisely the known fields of other as the most specific safe type.
      return other.name === FACET_NAME ? other : undefined
    },

    intersect: (other: Facet): Facet | undefined => {
      // The generics of 'this' are unknown, which makes intersection generally impossible to compute,
      // so return an empty record type as the most specific safe type.
      return other.name === FACET_NAME ? recordWith(EMPTY_RECORD_GENERICS) : undefined
    }
  }),

  with: recordWith,

  detail: (type: FacetType): RecordGenerics => {
    return type.getFacet(FACET_NAME).generics as RecordGenerics
  }
}

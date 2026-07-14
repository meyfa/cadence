import { makeFacet } from '../factory.ts'
import type { CustomComparable, FacetType, Value } from '../types.ts'

export interface Module {
  readonly name: string
  readonly exports: ReadonlyMap<string, Value>

  // documentation
  readonly summary?: string
}

interface ModuleGeneric extends CustomComparable {
  readonly value: Module
}

const FACET_NAME = 'module'

export const ModuleFacet = {
  ...makeFacet<typeof FACET_NAME, Module>(FACET_NAME, {}),

  with: (value: Module) => {
    const generic: ModuleGeneric = {
      value,
      checkAssignableFrom: (other: unknown): boolean => {
        if (typeof other !== 'object' || other == null || !('value' in other)) {
          return false
        }

        const otherValue = (other as ModuleGeneric).value
        return value === otherValue
      }
    }

    return makeFacet<typeof FACET_NAME, Module>(FACET_NAME, { spec: generic }, {
      format: () => `${FACET_NAME}("${value.name}")`
    })
  },

  detail: (type: FacetType): Module => {
    const { generics } = type.getFacet(FACET_NAME)
    if (!('spec' in generics)) {
      throw new Error(`Invalid generics for ${FACET_NAME} facet`)
    }

    return (generics.spec as ModuleGeneric).value
  }
}

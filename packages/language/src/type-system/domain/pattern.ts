import type { Pattern } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.ts'

const FACET_NAME = 'pattern'

export const PatternFacet = makeFacet<typeof FACET_NAME, Pattern>(FACET_NAME, {})

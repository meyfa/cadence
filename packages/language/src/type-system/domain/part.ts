import type { Part } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.js'

const FACET_NAME = 'part'

export const PartFacet = makeFacet<typeof FACET_NAME, Part>(FACET_NAME, {})

import type { Source } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.js'

const FACET_NAME = 'source'

export const SourceFacet = makeFacet<typeof FACET_NAME, Source>(FACET_NAME, {})

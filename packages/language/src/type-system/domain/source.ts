import type { Source } from '@core'
import { makeFacet } from '../factory.js'

const FACET_NAME = 'source'

export const SourceFacet = makeFacet<typeof FACET_NAME, Source>(FACET_NAME, {})

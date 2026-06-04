import type { Pattern } from '@core'
import { makeFacet } from '../factory.js'

const FACET_NAME = 'pattern'

export const PatternFacet = makeFacet<typeof FACET_NAME, Pattern>(FACET_NAME, {})

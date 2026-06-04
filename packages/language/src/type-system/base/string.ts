import { makeFacet } from '../factory.js'

const FACET_NAME = 'string'

export const StringFacet = makeFacet<typeof FACET_NAME, string>(FACET_NAME, {})

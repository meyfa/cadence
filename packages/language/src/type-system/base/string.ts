import { makeFacet } from '../factory.ts'

const FACET_NAME = 'string'

export const StringFacet = makeFacet<typeof FACET_NAME, string>(FACET_NAME, {})

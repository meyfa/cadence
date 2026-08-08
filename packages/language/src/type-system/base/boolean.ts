import { makeFacet } from '../factory.ts'

const FACET_NAME = 'boolean'

export const BooleanFacet = makeFacet<typeof FACET_NAME, boolean>(FACET_NAME, {})

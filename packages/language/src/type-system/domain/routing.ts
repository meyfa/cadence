import type { InstrumentRouting } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.ts'

const FACET_NAME = 'routing'

export const RoutingFacet = makeFacet<typeof FACET_NAME, InstrumentRouting>(FACET_NAME, {})

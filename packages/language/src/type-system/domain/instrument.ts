import type { Instrument } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.ts'

const FACET_NAME = 'instrument'

export const InstrumentFacet = makeFacet<typeof FACET_NAME, Instrument>(FACET_NAME, {})

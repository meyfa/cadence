import type { Instrument } from '@core'
import { makeFacet } from '../factory.js'

const FACET_NAME = 'instrument'

export const InstrumentFacet = makeFacet<typeof FACET_NAME, Instrument>(FACET_NAME, {})

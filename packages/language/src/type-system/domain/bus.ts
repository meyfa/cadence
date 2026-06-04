import type { Bus } from '@core'
import { makeFacet } from '../factory.js'

const FACET_NAME = 'bus'

export const BusFacet = makeFacet<typeof FACET_NAME, Bus>(FACET_NAME, {})

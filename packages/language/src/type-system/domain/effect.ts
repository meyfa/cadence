import type { Effect } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.js'

const FACET_NAME = 'effect'

export const EffectFacet = makeFacet<typeof FACET_NAME, Effect>(FACET_NAME, {})

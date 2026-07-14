import type { Mixer } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.ts'

const FACET_NAME = 'mixer'

export const MixerFacet = makeFacet<typeof FACET_NAME, Mixer>(FACET_NAME, {})

import type { Track } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.ts'

const FACET_NAME = 'track'

export const TrackFacet = makeFacet<typeof FACET_NAME, Track>(FACET_NAME, {})

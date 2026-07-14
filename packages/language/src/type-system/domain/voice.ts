import type { Voice } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.ts'

const FACET_NAME = 'voice'

export const VoiceFacet = makeFacet<typeof FACET_NAME, Voice>(FACET_NAME, {})

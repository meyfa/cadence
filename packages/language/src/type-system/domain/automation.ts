import type { Automation } from '@meyfa/cadence-core'
import { makeFacet } from '../factory.ts'

const FACET_NAME = 'automation'

export const AutomationFacet = makeFacet<typeof FACET_NAME, Automation>(FACET_NAME, {})

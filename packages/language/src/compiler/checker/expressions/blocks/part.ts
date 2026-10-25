import type { ast } from '@meyfa/cadence-ast'
import { AutomationFacet } from '../../../../type-system/domain/automation.ts'
import { PartFacet } from '../../../../type-system/domain/part.ts'
import { RoutingFacet } from '../../../../type-system/domain/routing.ts'
import { partSchema } from '../../../common.ts'
import type { SlotName } from '../../emissions.ts'
import { createBlockChecker } from '../blocks.ts'

export const checkPart = createBlockChecker<ast.Part>({
  facet: PartFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: partSchema,

  slots: [
    {
      name: 'routing' as SlotName,
      type: RoutingFacet.type()
    },
    {
      name: 'automation' as SlotName,
      type: AutomationFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

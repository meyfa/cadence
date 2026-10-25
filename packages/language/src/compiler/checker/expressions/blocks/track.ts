import type { ast } from '@meyfa/cadence-ast'
import { PartFacet } from '../../../../type-system/domain/part.ts'
import { TrackFacet } from '../../../../type-system/domain/track.ts'
import { trackSchema } from '../../../common.ts'
import type { SlotName } from '../../emissions.ts'
import { createBlockChecker } from '../blocks.ts'

export const checkTrack = createBlockChecker<ast.Track>({
  facet: TrackFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: trackSchema,

  slots: [
    {
      name: 'part' as SlotName,
      type: PartFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

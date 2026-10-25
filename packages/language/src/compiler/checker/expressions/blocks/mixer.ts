import type { ast } from '@meyfa/cadence-ast'
import { BusFacet } from '../../../../type-system/domain/bus.ts'
import { MixerFacet } from '../../../../type-system/domain/mixer.ts'
import { mixerSchema } from '../../../common.ts'
import type { SlotName } from '../../emissions.ts'
import { createBlockChecker } from '../blocks.ts'

export const checkMixer = createBlockChecker<ast.Mixer>({
  facet: MixerFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: mixerSchema,

  slots: [
    {
      name: 'bus' as SlotName,
      type: BusFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

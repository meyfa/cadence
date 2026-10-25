import type { ast } from '@meyfa/cadence-ast'
import { InstrumentFacet } from '../../../../type-system/domain/instrument.ts'
import { VoiceFacet } from '../../../../type-system/domain/voice.ts'
import { instrumentSchema } from '../../../common.ts'
import type { SlotName } from '../../emissions.ts'
import { createBlockChecker } from '../blocks.ts'

export const checkInstrument = createBlockChecker<ast.Instrument>({
  facet: InstrumentFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: instrumentSchema,

  slots: [
    {
      name: 'voice' as SlotName,
      type: VoiceFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

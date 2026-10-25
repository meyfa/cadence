import type { ast } from '@meyfa/cadence-ast'
import { BusFacet } from '../../../../type-system/domain/bus.ts'
import { EffectFacet } from '../../../../type-system/domain/effect.ts'
import { InstrumentFacet } from '../../../../type-system/domain/instrument.ts'
import { ParameterFacet } from '../../../../type-system/domain/parameter.ts'
import { makeUnionType } from '../../../../type-system/factory.ts'
import { busSchema } from '../../../common.ts'
import type { SlotName } from '../../emissions.ts'
import type { Binding } from '../../scopes.ts'
import { createBlockChecker } from '../blocks.ts'

export const checkBus = createBlockChecker<ast.Bus>({
  facet: BusFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: busSchema,

  slots: [
    {
      name: 'input' as SlotName,
      type: makeUnionType(BusFacet.type(), InstrumentFacet.type())
    },
    {
      name: 'effect' as SlotName,
      type: EffectFacet.type()
    }
  ],

  properties: {
    allow: true,
    initial: new Map<string, Binding>([
      [
        'gain',
        {
          name: 'gain',
          type: ParameterFacet.with('db').type(),
          definite: true
        }
      ],
      [
        'pan',
        {
          name: 'pan',
          type: ParameterFacet.with(undefined).type(),
          definite: true
        }
      ]
    ])
  }
})

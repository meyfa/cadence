import type { ast } from '@meyfa/cadence-ast'
import { CurveFacet } from '../../../../type-system/domain/curve.ts'
import { SourceFacet } from '../../../../type-system/domain/source.ts'
import { VoiceFacet } from '../../../../type-system/domain/voice.ts'
import { noteType } from '../../../common.ts'
import type { SlotName } from '../../emissions.ts'
import type { Binding } from '../../scopes.ts'
import { createBlockChecker } from '../blocks.ts'

export const checkVoice = createBlockChecker<ast.Voice>({
  facet: VoiceFacet,

  ownCapabilities: { mayBlock: false },
  allowedCapabilities: { mayBlock: false },

  slots: [
    {
      name: 'envelope' as SlotName,
      type: CurveFacet.with('db').type(),
      required: true,
      singular: true
    },
    {
      name: 'output' as SlotName,
      type: SourceFacet.type(),
      required: true,
      singular: true
    }
  ],

  getBindings: (expression) => {
    const bindings = new Map<string, Binding>()

    if (expression.bindings.note != null) {
      bindings.set(expression.bindings.note.name, {
        name: expression.bindings.note.name,
        type: noteType,
        definite: true,
        range: expression.bindings.note.range
      })
    }

    return bindings
  }
})

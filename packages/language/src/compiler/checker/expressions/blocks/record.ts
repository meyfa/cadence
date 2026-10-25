import type { ast } from '@meyfa/cadence-ast'
import { RecordFacet } from '../../../../type-system/base/record.ts'
import { noCapabilities } from '../../capabilities.ts'
import { createBlockChecker } from '../blocks.ts'

export const checkRecord = createBlockChecker<ast.RecordValue>({
  facet: RecordFacet,
  ownCapabilities: noCapabilities,
  properties: {
    allow: true
  }
})

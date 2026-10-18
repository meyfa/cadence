import type { TreeCursor } from '@lezer/common'
import { toSourceRange } from '../../../utilities/text.ts'
import type { WalkContext } from '../context.ts'

export function walkArgumentName (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  context.builder.addIdentifier({
    kind: 'argument',
    scopeId,
    name: context.document.sliceString(cursor.from, cursor.to),
    range: toSourceRange(context.document, cursor.from, cursor.to)
  })
}

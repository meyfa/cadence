import type { SourceRange } from '../../../utilities/range.ts'
import type { TextLike } from '../../../utilities/text.ts'
import { toSourceRange } from '../../../utilities/text.ts'

export interface VariableName {
  readonly name: string
  readonly range: SourceRange
}

/**
 * Retrieves the trimmed variable name from the given document range.
 *
 * Background: The parser can produce nodes with trailing whitespace (possibly a bug).
 * Example (emits "kick " with a trailing space):
 *     track { part { kick } }
 */
export function getVariableName (document: TextLike, from: number, to: number): VariableName {
  const name = document.sliceString(from, to).trimEnd()
  const range = toSourceRange(document, from, from + name.length)

  return { name, range }
}

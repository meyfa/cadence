import type { Tree } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import { analyzeTree } from '../analysis/model.js'
import { findUnusedAssignmentBindings } from '../analysis/query.js'
import type { LanguageDiagnostic } from '../types.js'
import type { TextLike } from '../analysis/text.js'
import { textFromString } from '../analysis/text.js'

export function findUnusedVariablesInTree (tree: Tree, document: TextLike): readonly LanguageDiagnostic[] {
  const model = analyzeTree(tree, document)

  return findUnusedAssignmentBindings(model, tree, document).map((binding) => ({
    name: binding.name,
    message: `Unused variable "${binding.name}".`,
    range: binding.range
  }))
}

export function findUnusedVariablesWithParser (parser: LRParser, source: string): readonly LanguageDiagnostic[] {
  const tree = parser.parse(source)
  return findUnusedVariablesInTree(tree, textFromString(source))
}

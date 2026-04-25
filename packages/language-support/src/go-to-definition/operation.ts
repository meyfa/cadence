import type { Tree } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import { analyzeTree } from '../analysis/model.js'
import { findDefinitionBindingAt } from '../analysis/query.js'
import type { SourceRange } from '../types.js'
import type { TextLike } from '../analysis/text.js'
import { textFromString } from '../analysis/text.js'

export interface GoToDefinitionResult {
  readonly name: string
  readonly range: SourceRange
}

export function goToDefinitionInTree (tree: Tree, document: TextLike, pos: number): GoToDefinitionResult | undefined {
  const model = analyzeTree(tree, document)
  const binding = findDefinitionBindingAt(model, tree, document, pos)
  if (binding == null) {
    return undefined
  }

  return { name: binding.name, range: binding.range }
}

export function goToDefinitionWithParser (parser: LRParser, source: string, pos: number): GoToDefinitionResult | undefined {
  const tree = parser.parse(source)
  return goToDefinitionInTree(tree, textFromString(source), pos)
}

import type { Tree } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import type { TextLike } from '../analysis/model.js'
import { analyzeTree } from '../analysis/model.js'
import { findDefinitionBindingAt } from '../analysis/query.js'

export interface GoToDefinitionResult {
  readonly name: string
  readonly from: number
  readonly to: number
}

export function goToDefinitionInTree (tree: Tree, document: TextLike, pos: number): GoToDefinitionResult | undefined {
  const model = analyzeTree(tree, document)
  const binding = findDefinitionBindingAt(model, tree, document, pos)
  if (binding == null) {
    return undefined
  }

  return { name: binding.name, from: binding.from, to: binding.to }
}

export function goToDefinitionWithParser (parser: LRParser, source: string, pos: number): GoToDefinitionResult | undefined {
  const tree = parser.parse(source)
  return goToDefinitionInTree(tree, {
    length: source.length,
    sliceString: (from, to) => source.slice(from, to)
  }, pos)
}

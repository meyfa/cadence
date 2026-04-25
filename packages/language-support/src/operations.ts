import type { Tree } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import { textFromString } from './analysis/text.js'
import type { TextLike } from './types.js'
import { analyzeTree, type Model } from './analysis/model.js'

export type SemanticOperation<Args extends readonly unknown[], Result> =
  (model: Model, tree: Tree, document: TextLike, ...args: Args) => Result

export function applySemanticOperation<Args extends readonly unknown[], Result> (
  operation: SemanticOperation<Args, Result>,
  tree: Tree,
  document: TextLike,
  ...args: Args
): Result {
  const model = analyzeTree(tree, document)
  return operation(model, tree, document, ...args)
}

export function applySemanticOperationWithParser<Args extends readonly unknown[], Result> (
  operation: SemanticOperation<Args, Result>,
  parser: LRParser,
  source: string,
  ...args: Args
): Result {
  const tree = parser.parse(source)
  const document = textFromString(source)
  const model = analyzeTree(tree, document)
  return operation(model, tree, document, ...args)
}

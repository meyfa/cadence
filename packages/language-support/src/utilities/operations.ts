import type { Tree } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import { analyzeSourceWithParser, analyzeTree } from '../model/analysis.ts'
import type { Model } from '../model/model.ts'
import type { TextLike } from './text.ts'

export type SemanticOperation<Args extends readonly unknown[], Result> =
  (model: Model, ...args: Args) => Result

export function applySemanticOperation<Args extends readonly unknown[], Result> (
  operation: SemanticOperation<Args, Result>,
  tree: Tree,
  document: TextLike,
  ...args: Args
): Result {
  const model = analyzeTree(tree, document)
  return operation(model, ...args)
}

export function applySemanticOperationWithParser<Args extends readonly unknown[], Result> (
  operation: SemanticOperation<Args, Result>,
  parser: LRParser,
  source: string,
  ...args: Args
): Result {
  const model = analyzeSourceWithParser(parser, source)
  return operation(model, ...args)
}

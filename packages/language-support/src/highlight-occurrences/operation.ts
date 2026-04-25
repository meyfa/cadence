import type { Tree } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import { analyzeTree } from '../analysis/model.js'
import { findReferenceRangesAt } from '../analysis/query.js'
import type { TextLike } from '../analysis/text.js'
import { textFromString } from '../analysis/text.js'
import type { SourceRange } from '../types.js'

export function findHighlightedOccurrencesInTree (tree: Tree, document: TextLike, pos: number): readonly SourceRange[] {
  const model = analyzeTree(tree, document)
  return findReferenceRangesAt(model, tree, document, pos)
}

export function findHighlightedOccurrencesWithParser (parser: LRParser, source: string, pos: number): readonly SourceRange[] {
  const tree = parser.parse(source)
  return findHighlightedOccurrencesInTree(tree, textFromString(source), pos)
}

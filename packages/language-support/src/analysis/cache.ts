import type { Tree } from '@lezer/common'
import type { TextLike } from '../types.js'
import type { Model } from './model.js'
import { analyzeTree } from './model.js'

interface CachedModel {
  readonly document: TextLike
  readonly model: Model
}

const cachedModels = new WeakMap<Tree, CachedModel>()

export function getAnalysisModel (tree: Tree, document: TextLike): Model {
  const cached = cachedModels.get(tree)
  if (cached != null && cached.document === document) {
    return cached.model
  }

  const model = analyzeTree(tree, document)
  cachedModels.set(tree, { document, model })

  return model
}

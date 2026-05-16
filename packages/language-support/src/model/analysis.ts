import type { Tree } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import type { TextLike } from '../utilities/text.js'
import { textFromString } from '../utilities/text.js'
import { computeBaseModel } from './analysis/base.js'
import { computeKnownValueModel } from './analysis/known-values.js'
import { computeReferenceModel } from './analysis/references.js'
import type { Model } from './model.js'

interface CachedModel {
  readonly document: TextLike
  readonly model: Model
}

const cachedModels = new WeakMap<Tree, CachedModel>()

export function analyzeTree (tree: Tree, document: TextLike): Model {
  const cached = cachedModels.get(tree)
  if (cached != null && cached.document === document) {
    return cached.model
  }

  const model = computeModel(tree, document)
  cachedModels.set(tree, { document, model })

  return model
}

export function analyzeSourceWithParser (parser: LRParser, source: string): Model {
  return analyzeTree(parser.parse(source), textFromString(source))
}

function computeModel (tree: Tree, document: TextLike): Model {
  const baseModel = computeBaseModel(tree, document)
  const referenceModel = computeReferenceModel(baseModel)
  const knownValueModel = computeKnownValueModel(baseModel, referenceModel)

  return { ...baseModel, ...referenceModel, ...knownValueModel }
}

export { cadenceLanguageSupport } from './language-support.ts'

export type * from './utilities/diagnostic.ts'

export type { SemanticOperation } from './utilities/operations.ts'
export { applySemanticOperation, applySemanticOperationWithParser } from './utilities/operations.ts'

// "go to definition" feature
export { goToDefinition } from './go-to-definition/operation.ts'
export { goToDefinitionExtension } from './go-to-definition/extension.ts'

// "highlight occurrences" feature
export { findHighlightedOccurrences } from './highlight-occurrences/operation.ts'
export { highlightOccurrencesExtension } from './highlight-occurrences/extension.ts'

// "hover info" feature
export type { HoverInfoWithRange } from './hover/operation.ts'
export { getHoverInfo } from './hover/operation.ts'
export { hoverInfoExtension } from './hover/extension.ts'

// "unused variable" diagnostics
export { findUnusedVariables } from './unused-variable/operation.ts'

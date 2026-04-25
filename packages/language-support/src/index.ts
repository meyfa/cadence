// main language support exports
export type * from './types.js'
export { cadenceLanguageSupport } from './language-support.js'

export type { SemanticOperation } from './operations.js'
export { applySemanticOperation, applySemanticOperationWithParser } from './operations.js'

// "go to definition" feature
export { goToDefinition } from './go-to-definition/operation.js'
export { goToDefinitionExtension } from './go-to-definition/extension.js'

// "highlight occurrences" feature
export { findHighlightedOccurrences } from './highlight-occurrences/operation.js'
export { highlightOccurrencesExtension } from './highlight-occurrences/extension.js'

// "unused variable" diagnostics
export { findUnusedVariables } from './unused-variable/operation.js'

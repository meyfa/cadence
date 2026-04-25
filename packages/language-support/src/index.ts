// main language support exports
export type * from './types.js'
export { cadenceLanguageSupport } from './language-support.js'

// "go to definition" feature
export { goToDefinitionInTree, goToDefinitionWithParser } from './go-to-definition/operation.js'
export { goToDefinitionExtension } from './go-to-definition/extension.js'

// "highlight occurrences" feature
export { findHighlightedOccurrencesInTree, findHighlightedOccurrencesWithParser } from './highlight-occurrences/operation.js'
export { highlightOccurrencesExtension } from './highlight-occurrences/extension.js'

// "unused variable" diagnostics
export { findUnusedVariablesInTree, findUnusedVariablesWithParser } from './unused-variable/operation.js'

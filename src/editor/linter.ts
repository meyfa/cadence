import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import { parse } from '../language/parser.js'
import type { Location } from '../language/location.js'

function convertError (message: string, location: Location | undefined): Diagnostic {
  return {
    from: location?.offset ?? 0,
    to: (location?.offset ?? 0) + (location?.length ?? 0),
    severity: 'error',
    message
  }
}

/**
 * A linter function for CodeMirror that uses the Cadence parser to check for errors.
 *
 * @param view The editor view to lint
 * @returns An array of diagnostics representing any parse errors found
 */
export function cadenceLinter (view: EditorView): Diagnostic[] {
  const input = view.state.doc.sliceString(0)

  try {
    const result = parse(input)
    if (!result.complete) {
      return [convertError(result.error.message, result.error.location)]
    }
  } catch (error) {
    if (error instanceof Error) {
      return [convertError(`Fatal error: ${error.message}`, undefined)]
    }

    throw error
  }

  return []
}
